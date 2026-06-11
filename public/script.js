(function () {
  const formSection = document.getElementById('formSection');
  const loadingSection = document.getElementById('loadingSection');
  const resultsSection = document.getElementById('resultsSection');
  const resultErrorSection = document.getElementById('resultErrorSection');
  const canceledSection = document.getElementById('canceledSection');

  const resumeInput = document.getElementById('resumeInput');
  const resumeFileInput = document.getElementById('resumeFileInput');
  const fileNameEl = document.getElementById('fileName');
  const jobTitleInput = document.getElementById('jobTitleInput');
  const enhanceBtn = document.getElementById('enhanceBtn');
  const formError = document.getElementById('formError');

  const resultJobTitle = document.getElementById('resultJobTitle');
  const originalResumeEl = document.getElementById('originalResume');
  const enhancedResumeEl = document.getElementById('enhancedResume');
  const resultErrorMessage = document.getElementById('resultErrorMessage');
  const copyBtn = document.getElementById('copyBtn');

  const STORAGE_KEY = 'resumeEnhancer.pendingSubmission';

  resumeFileInput.addEventListener('change', () => {
    const file = resumeFileInput.files[0];
    console.log('[resume-enhancer] file input change event. files:', resumeFileInput.files, 'selected file:', file);
    fileNameEl.textContent = file ? file.name : '';
  });

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
    const file = resumeFileInput.files && resumeFileInput.files.length > 0
      ? resumeFileInput.files[0]
      : null;

    console.log('[resume-enhancer] Enhance button clicked.');
    console.log('[resume-enhancer] resumeFileInput element:', resumeFileInput);
    console.log('[resume-enhancer] resumeFileInput.files:', resumeFileInput.files);
    console.log('[resume-enhancer] detected file:', file);
    console.log('[resume-enhancer] pasted resume text length:', resume.length);
    console.log('[resume-enhancer] jobTitle:', jobTitle);

    enhanceBtn.disabled = true;
    enhanceBtn.textContent = 'Redirecting to payment...';

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ jobTitle }));

      const formData = new FormData();
      formData.append('jobTitle', jobTitle);
      if (file) {
        formData.append('resumeFile', file);
        console.log('[resume-enhancer] Appended resumeFile to FormData:', file.name, file.type, file.size, 'bytes');
      } else {
        formData.append('resumeText', resume);
        console.log('[resume-enhancer] Appended resumeText to FormData, length:', resume.length);
      }

      console.log('[resume-enhancer] FormData contents:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: File(name=${value.name}, type=${value.type}, size=${value.size})`);
        } else {
          console.log(`  ${key}:`, value);
        }
      }

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        body: formData,
      });

      console.log('[resume-enhancer] /api/create-checkout-session response status:', res.status);

      const data = await res.json();
      console.log('[resume-enhancer] /api/create-checkout-session response body:', data);

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
    handlePostPayment(sessionId, dataId);
  } else if (canceled) {
    showSection(canceledSection);
  } else {
    showSection(formSection);
  }
})();
