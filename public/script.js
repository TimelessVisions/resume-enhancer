document.getElementById('enhanceBtn').addEventListener('click', async () => {
  const formData = new FormData();
  formData.append('resumeFile', document.getElementById('resumeFileInput').files[0]);
  formData.append('resumeText', document.getElementById('resumeInput').value);
  formData.append('jobTitle', document.getElementById('jobTitleInput').value);
  const res = await fetch('/api/create-checkout-session', { method: 'POST', body: formData });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
});
