document.getElementById('enhanceBtn').addEventListener('click', async () => {
  const formData = new FormData();
  formData.append('resumeFile', document.getElementById('resumeFileInput').files[0]);
  formData.append('resumeText', document.getElementById('resumeInput').value);
  formData.append('jobTitle', document.getElementById('jobTitleInput').value);
  const res = await fetch('/api/create-checkout-session', { method: 'POST', body: formData });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
});

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session_id');
const dataId = params.get('data_id');

if (sessionId && dataId) {
  document.getElementById('formSection').classList.add('hidden');
  document.getElementById('loadingSection').classList.remove('hidden');

  fetch(`/api/enhance?session_id=${sessionId}&data_id=${dataId}`)
    .then((res) => res.json())
    .then((data) => {
      document.getElementById('loadingSection').classList.add('hidden');
      if (data.enhanced) {
        document.getElementById('resultJobTitle').textContent = data.jobTitle;
        document.getElementById('originalResume').textContent = data.original;
        document.getElementById('enhancedResume').textContent = data.enhanced;
        document.getElementById('resultsSection').classList.remove('hidden');
      } else {
        document.getElementById('resultErrorMessage').textContent = data.error || 'Something went wrong.';
        document.getElementById('resultErrorSection').classList.remove('hidden');
      }
    });
}
