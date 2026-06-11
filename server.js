require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const PORT = process.env.PORT || 3000;
const PRICE_USD_CENTS = 500; // $5.00
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

// Extract plain text from an uploaded PDF or DOCX file.
async function extractTextFromFile(file) {
  const name = (file.originalname || '').toLowerCase();

  if (file.mimetype === 'application/pdf' || name.endsWith('.pdf')) {
    const data = await pdfParse(file.buffer);
    return data.text.trim();
  }

  if (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value.trim();
  }

  throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY in environment.');
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in environment.');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (/\.(html|js|css)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// In-memory store for pending resume submissions, keyed by a one-time data ID.
// Entries are cleaned up after use or after expiry.
const pendingSubmissions = new Map();
const SUBMISSION_TTL_MS = 60 * 60 * 1000; // 1 hour

function cleanupExpiredSubmissions() {
  const now = Date.now();
  for (const [id, entry] of pendingSubmissions.entries()) {
    if (now - entry.createdAt > SUBMISSION_TTL_MS) {
      pendingSubmissions.delete(id);
    }
  }
}
setInterval(cleanupExpiredSubmissions, 15 * 60 * 1000);

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/+$/, '');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}`;
}

// Create a Stripe Checkout session for the $5 resume enhancement.
app.post('/api/create-checkout-session', upload.single('resumeFile'), async (req, res) => {
  try {
    const jobTitle = typeof req.body.jobTitle === 'string' ? req.body.jobTitle.trim() : '';
    let resume = typeof req.body.resumeText === 'string' ? req.body.resumeText.trim() : '';

    if (req.file) {
      try {
        resume = await extractTextFromFile(req.file);
      } catch (err) {
        return res.status(400).json({ error: err.message || 'Failed to read uploaded file.' });
      }
    }

    if (!resume) {
      return res.status(400).json({ error: 'Please paste your resume text or upload a PDF/DOCX file.' });
    }
    if (!jobTitle) {
      return res.status(400).json({ error: 'Job title is required.' });
    }
    if (resume.length > 20000) {
      return res.status(400).json({ error: 'Resume text is too long (max 20,000 characters).' });
    }
    if (jobTitle.length > 200) {
      return res.status(400).json({ error: 'Job title is too long (max 200 characters).' });
    }

    const dataId = uuidv4();
    pendingSubmissions.set(dataId, {
      resume,
      jobTitle,
      createdAt: Date.now(),
    });

    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: PRICE_USD_CENTS,
            product_data: {
              name: 'AI Resume Enhancement',
              description: `Tailored resume rewrite for: ${jobTitle}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}&data_id=${dataId}`,
      cancel_url: `${baseUrl}/?canceled=true`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

// Verify payment, then call Claude to enhance the resume.
app.get('/api/enhance', async (req, res) => {
  try {
    const { session_id: sessionId, data_id: dataId } = req.query;

    if (!sessionId || !dataId) {
      return res.status(400).json({ error: 'Missing session_id or data_id.' });
    }

    const submission = pendingSubmissions.get(dataId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found or already processed.' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed.' });
    }

    const { resume, jobTitle } = submission;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system:
        'You are an expert resume writer and career coach. You rewrite resumes to be ' +
        'more impactful, concise, and tailored to a specific job title, using strong ' +
        'action verbs, quantifiable achievements where possible, and relevant keywords. ' +
        'Preserve the factual content of the original resume (do not invent jobs, ' +
        'employers, dates, degrees, or accomplishments) but improve wording, structure, ' +
        'and emphasis. Return ONLY the rewritten resume text, with no preamble, ' +
        'commentary, or markdown code fences.',
      messages: [
        {
          role: 'user',
          content:
            `Job title I'm applying for: ${jobTitle}\n\n` +
            `Here is my current resume:\n\n${resume}\n\n` +
            `Please rewrite this resume to be tailored for the "${jobTitle}" role.`,
        },
      ],
    });

    const enhanced = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    // One-time use: remove the submission once successfully processed.
    pendingSubmissions.delete(dataId);

    res.json({ original: resume, jobTitle, enhanced });
  } catch (err) {
    console.error('Error enhancing resume:', err);
    res.status(500).json({ error: 'Failed to enhance resume.' });
  }
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// Handle multer errors (e.g. file too large) with a friendly JSON response.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large (max 5MB).' });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Resume Enhancer server running on port ${PORT}`);
});
