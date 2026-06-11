(function () {
  const formSection = document.getElementById('formSection');
  const loadingSection = document.getElementById('loadingSection');
  const resultsSection = document.getElementById('resultsSection');
  const resultErrorSection = document.getElementById('resultErrorSection');
  const canceledSection = document.getElementById('canceledSection');

  const resumeInput = document.getElementById('resumeInput');
  const jobTitleInput = document.getElementById('jobTitleInput');
  const enhanceBtn = document.getElementById('enhanceBtn');
  const formError = document.getElementById('formError');

  const resultJobTitle = document.getElementById('resultJobTitle');
  const originalResumeEl = document.getElementById('originalResume');
  const enhancedResumeEl = document.getElementById('enhancedResume');
  const resultErrorMessage = document.getElementById('resultErrorMessage');
  const copyBtn = document.getElementById('copyBtn');

  const STORAGE_KEY = 'resumeEnhancer.pendingSubmission';

  function showSection(section) {
    [formSection, loadingSection, resultsSection, resultErrorSection, canceledSection].forEach((s) => {
      s.classList.add('hidden');
    });
    section.classList.remove('hidden');
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.classList.remove('hidden');
  }

  function clearFormError() {
    formError.classList.add('hidden');
    formError.textContent = '';
  }

  async function startCheckout() {
    clearFormError();
    const resume = resumeInput.value.trim();
    const jobTitle = jobTitleInput.value.trim();

    if (!resume) {
      showFormError('Please paste your resume text.');
      return;
    }
    if (!jobTitle) {
      showFormError('Please enter the job title you are applying for.');
      return;
    }

    enhanceBtn.disabled = true;
    enhanceBtn.textContent = 'Redirecting to payment...';

    try {
      // Save the original resume locally so we can show the "before" panel
      // after returning from Stripe.
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ resume, jobTitle }));

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, jobTitle }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start checkout.');
      }

      window.location.href = data.url;
    } catch (err) {
      showFormError(err.message || 'Something went wrong. Please try again.');
      enhanceBtn.disabled = false;
      enhanceBtn.textContent = 'Enhance My Resume — $5';
    }
  }

  async function handlePostPayment(sessionId, dataId) {
    showSection(loadingSection);

    try {
      const res = await fetch(`/api/enhance?session_id=${encodeURIComponent(sessionId)}&data_id=${encodeURIComponent(dataId)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to enhance resume.');
      }

      resultJobTitle.textContent = data.jobTitle;
      originalResumeEl.textContent = data.original;
      enhancedResumeEl.textContent = data.enhanced;

      sessionStorage.removeItem(STORAGE_KEY);
      showSection(resultsSection);
    } catch (err) {
      resultErrorMessage.textContent = err.message || 'Something went wrong while enhancing your resume.';
      showSection(resultErrorSection);
    }
  }

  function resetToForm() {
    sessionStorage.removeItem(STORAGE_KEY);
    enhanceBtn.disabled = false;
    enhanceBtn.textContent = 'Enhance My Resume — $5';
    window.history.replaceState({}, document.title, window.location.pathname);
    showSection(formSection);
  }

  function copyEnhanced() {
    const text = enhancedResumeEl.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const original = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1500);
    });
  }

  // Wire up events
  enhanceBtn.addEventListener('click', startCheckout);
  document.getElementById('restartBtn').addEventListener('click', resetToForm);
  document.getElementById('restartBtn2').addEventListener('click', resetToForm);
  document.getElementById('restartBtn3').addEventListener('click', resetToForm);
  copyBtn.addEventListener('click', copyEnhanced);

  // On load, check URL for Stripe redirect params
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  const dataId = params.get('data_id');
  const canceled = params.get('canceled');

  if (sessionId && dataId) {
    // Restore original resume text for the "before" panel from this browser session
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        originalResumeEl.textContent = parsed.resume || '';
      } catch (e) {
        // ignore
      }
    }
    handlePostPayment(sessionId, dataId);
  } else if (canceled) {
    showSection(canceledSection);
  } else {
    showSection(formSection);
  }
})();
