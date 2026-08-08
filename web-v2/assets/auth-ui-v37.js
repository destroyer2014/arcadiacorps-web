import {
  supabase,
  signInWithProvider,
  signInWithPassword,
  signUpWithPassword,
  safeNextPath
} from './auth.js?v=40.2';
import { createCaptchaController, captchaIsConfigured } from './turnstile-v37.js?v=40.1';

const $ = selector => document.querySelector(selector);
const message = $('#message');
const next = safeNextPath(new URLSearchParams(location.search).get('next'));
const captcha = await createCaptchaController($('#captchaBox'));

function show(text,type='error') {
  message.textContent = text;
  message.className = `message show ${type}`;
}
function clearMessage() {
  message.textContent = '';
  message.className = 'message';
}
function friendlyAuthError(error) {
  const text = String(error?.message || '');
  const code = String(error?.code || '');
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(text)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(text)) return 'Debes confirmar tu correo antes de iniciar sesión.';
  if (/captcha/i.test(text)) return 'Completa la verificación anti-bots y vuelve a intentarlo.';
  if (/rate limit|too many/i.test(text)) return 'Demasiados intentos. Espera un momento.';
  return text || 'No se pudo completar el acceso.';
}

function setMode(mode) {
  const register = mode === 'register';
  $('#loginPanel').hidden = register;
  $('#registerPanel').hidden = !register;
  $('#loginTab').classList.toggle('active',!register);
  $('#registerTab').classList.toggle('active',register);
  clearMessage();
  captcha.reset();
}
$('#loginTab').onclick = () => setMode('login');
$('#registerTab').onclick = () => setMode('register');

document.querySelectorAll('[data-password-toggle]').forEach(button => {
  button.onclick = () => {
    const input = document.querySelector(button.dataset.passwordToggle);
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Ocultar' : 'Ver';
  };
});

const params = new URLSearchParams(location.search);
if (params.get('logout') === '1') show('Sesión cerrada correctamente.','ok');
if (params.get('password') === 'updated') show('Contraseña actualizada. Ya puedes iniciar sesión.','ok');

const { data:{ session } } = await supabase.auth.getSession();
if (session && params.get('logout') !== '1') location.replace(next);

async function oauth(provider,button) {
  clearMessage();
  button.disabled = true;
  const old = button.innerHTML;
  button.textContent = 'Redirigiendo…';
  try {
    sessionStorage.setItem('arcadia-auth-next',next);
    await signInWithProvider(provider);
  } catch (error) {
    show(friendlyAuthError(error));
    button.disabled = false;
    button.innerHTML = old;
  }
}
$('#googleBtn').onclick = event => oauth('google',event.currentTarget);
$('#githubBtn').onclick = event => oauth('github',event.currentTarget);

$('#loginForm').onsubmit = async event => {
  event.preventDefault();
  clearMessage();
  const button = event.currentTarget.querySelector('button[type=submit]');
  const token = captcha.getToken();
  if (captcha.configured && !token) return show('Completa la verificación anti-bots.');

  button.disabled = true;
  button.textContent = 'Verificando…';
  try {
    await signInWithPassword($('#loginEmail').value.trim(),$('#loginPassword').value,token);
    location.replace(next);
  } catch (error) {
    show(friendlyAuthError(error));
    captcha.reset();
  } finally {
    button.disabled = false;
    button.textContent = 'Iniciar sesión';
  }
};

function strength(password) {
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score,4);
}

$('#registerPassword').oninput = event => {
  const score = strength(event.currentTarget.value);
  $('#passwordStrengthBar').dataset.score = String(score);
  $('#passwordStrengthText').textContent = ['Muy débil','Débil','Aceptable','Fuerte','Muy fuerte'][score];
};

$('#registerForm').onsubmit = async event => {
  event.preventDefault();
  clearMessage();
  const button = event.currentTarget.querySelector('button[type=submit]');
  const email = $('#registerEmail').value.trim();
  const password = $('#registerPassword').value;
  const confirm = $('#registerConfirmPassword').value;
  const token = captcha.getToken();

  if (password.length < 10) return show('La contraseña debe tener al menos 10 caracteres.');
  if (password !== confirm) return show('Las contraseñas no coinciden.');
  if (captcha.configured && !token) return show('Completa la verificación anti-bots.');

  button.disabled = true;
  button.textContent = 'Creando cuenta…';
  try {
    const data = await signUpWithPassword(email,password,token);
    if (data.session) {
      location.replace(next);
      return;
    }
    show('Si el correo puede registrarse, recibirás un mensaje de confirmación. Revisa también spam.','ok');
    event.currentTarget.reset();
    captcha.reset();
  } catch (error) {
    show(friendlyAuthError(error));
    captcha.reset();
  } finally {
    button.disabled = false;
    button.textContent = 'Crear cuenta';
  }
};

if (!captchaIsConfigured()) $('#captchaHelp').hidden = false;
