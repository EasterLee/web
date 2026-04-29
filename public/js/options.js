const cities = await fetch('./data/cities.json').then(r => r.json());
const pathways = await fetch('./data/pathways.json').then(r => r.json());
const managers = await fetch('./data/managers.json').then(r => r.json());
const mainUrl = 'https://yearup.tfaforms.net/f/in-person-attendance';
const yuuEmail = '@my.yearupunited.org';

const questions = {
  name:	'tfa_2',
  email:	'tfa_4',
  city:	'tfa_23',
  pathway:	'tfa_28',
  pm:	'tfa_49'
};


const email = document.getElementById('email');
email.addEventListener('input', () => {
  email.value = email.value.replaceAll(' ', '');
});

const selectCity = document.getElementById('city');
cities.forEach(v => {
  selectCity.add(new Option(v[0], v[1]));
});
//copy(JSON.stringify([...document.querySelector('#tfa_23').children].map(v => [v.children[1].textContent, v.children[0].value]), null, 2))


const selectPathway = document.getElementById('pathway');
pathways.forEach(v => {
  selectPathway.add(new Option(v[0], v[1]));
});
//copy(JSON.stringify([...document.querySelector('#tfa_28').children].map(v => [v.children[1].textContent, v.children[0].value]), null, 2))


const selectManager = document.getElementById('pm');
managers.forEach(v => {
  selectManager.add(new Option(v, v));
});

function constructURL(url, data){

  if (data.name.length == 0)
    delete data.name;

  if (data.email.length == 0)
    delete data.email;
  else
    data.email = data.email + yuuEmail;
  
  const newData = {}
  Object.entries(data).forEach(v => {
    newData[questions[v[0]]] = v[1];
  })
  
  const params = new URLSearchParams(newData);
  return `${url}?${params.toString()}`;
}

const generatedContent = document.getElementById('post-generate');

const qrcodeElement = document.getElementById('qrcode');
const qrcode = new QRCode('qrcode')
const form = document.getElementById('the-form');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const url = constructURL(mainUrl, data);
  const urlElement = document.getElementById('yuu-url');
  urlElement.textContent = url;
  urlElement.href = url;
  generatedContent.style.display = '';
  qrcode.makeCode(url);
});