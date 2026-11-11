// Multi-step valuation form. DEMO MODE: nothing is sent anywhere.

const MESSAGES = {
  type: 'נא לבחור את סוג הנכס.',
  city: 'נא למלא עיר.',
  neighborhood: 'נא למלא שכונה.',
  rooms: 'נא להזין מספר חדרים (1–30).',
  area: 'נא להזין שטח בנוי במ"ר (20–5,000).',
  name: 'נא למלא שם מלא.',
  phone: 'מספר הטלפון אינו תקין. לדוגמה: 050-1234567',
};

/** Israeli phone: mobile 05X / 07X (10 digits) or landline 02-04, 08, 09 (9 digits). +972 accepted. */
export function isIsraeliPhone(value) {
  const v = value.replace(/[\s\-().]/g, '').replace(/^\+?972/, '0');
  return /^0(?:5\d|7\d|[2-489])\d{7}$/.test(v);
}

export function initForm({ onStepChange } = {}) {
  const form = document.getElementById('valuation-form');
  if (!form) return;

  const steps = [...form.querySelectorAll('[data-step]')];
  const total = steps.length;
  const btnPrev = form.querySelector('[data-prev]');
  const btnNext = form.querySelector('[data-next]');
  const btnSubmit = form.querySelector('[data-submit]');
  const errorEl = form.querySelector('#vform-error');
  const currentEl = form.querySelector('[data-step-current]');
  const bar = form.querySelector('.vform__progress-bar');
  const thanks = document.getElementById('valuation-thanks');
  let index = 0;

  const fieldError = (input) => {
    const { name } = input;
    const v = input.value.trim();
    if (input.type === 'radio') {
      return form.querySelector(`input[name="${name}"]:checked`) ? '' : MESSAGES[name];
    }
    if (!v) return MESSAGES[name];
    if (name === 'phone' && !isIsraeliPhone(v)) return MESSAGES.phone;
    if (name === 'name' && v.length < 2) return MESSAGES.name;
    if (input.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < Number(input.min) || n > Number(input.max)) return MESSAGES[name];
    }
    return '';
  };

  function validateStep(i) {
    const inputs = [...steps[i].querySelectorAll('input')];
    const seen = new Set();
    let first = null;
    let message = '';
    for (const input of inputs) {
      if (seen.has(input.name)) continue;
      seen.add(input.name);
      const err = fieldError(input);
      const group = input.type === 'radio' ? steps[i].querySelectorAll(`input[name="${input.name}"]`) : [input];
      group.forEach(el => {
        el.setAttribute('aria-invalid', err ? 'true' : 'false');
        if (err) el.setAttribute('aria-describedby', 'vform-error'); else el.removeAttribute('aria-describedby');
      });
      if (err && !first) { first = input; message = err; }
    }
    errorEl.textContent = message;
    if (first) first.focus();
    return !first;
  }

  function show(i, dir = 1) {
    const prev = index;
    index = i;
    steps.forEach((s, n) => {
      s.hidden = n !== i;
      s.classList.toggle('is-active', n === i);
    });
    btnPrev.hidden = i === 0;
    btnNext.hidden = i === total - 1;
    btnSubmit.hidden = i !== total - 1;
    currentEl.textContent = String(i + 1);
    bar.style.transform = `scaleX(${(i + 1) / total})`;
    errorEl.textContent = '';
    const firstInput = steps[i].querySelector('input');
    if (firstInput && prev !== i) firstInput.focus({ preventScroll: true });
    onStepChange?.(steps[i], dir);
    if (prev !== i) document.dispatchEvent(new CustomEvent('valuation:step', { detail: { step: steps[i], dir } }));
  }

  btnNext.addEventListener('click', () => {
    if (validateStep(index)) show(index + 1, 1);
  });
  btnPrev.addEventListener('click', () => show(index - 1, -1));

  // Enter in a text field moves to the next step instead of submitting early.
  form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && index < total - 1) {
      e.preventDefault();
      btnNext.click();
    }
  });

  // Clear an error as soon as the field becomes valid.
  form.addEventListener('input', e => {
    if (e.target.getAttribute('aria-invalid') === 'true' && !fieldError(e.target)) {
      e.target.setAttribute('aria-invalid', 'false');
      errorEl.textContent = '';
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateStep(index)) return;
    // Demo mode: no network request.
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus();
    document.dispatchEvent(new CustomEvent('valuation:submitted', { detail: { thanks } }));
  });

  show(0);
}
