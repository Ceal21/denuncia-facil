import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MOCK_USERS } from '../../data/mockData';
import styles from './Login.module.css';

const EMPTY_FORM = {
  dni: '',
  apellido_paterno: '',
  apellido_materno: '',
  nombres: '',
  telefono: '',
  email: '',
};

function validate(form) {
  const errors = {};
  if (!/^\d{8}$/.test(form.dni.trim())) errors.dni = 'Ingresa un DNI válido de 8 dígitos.';
  if (!form.apellido_paterno.trim()) errors.apellido_paterno = 'Campo requerido.';
  if (!form.nombres.trim()) errors.nombres = 'Campo requerido.';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = 'Ingresa un correo válido.';
  if (form.telefono && !/^\d{7,15}$/.test(form.telefono.trim()))
    errors.telefono = 'Solo dígitos (7–15 caracteres).';
  return errors;
}

function Field({ id, label, required, type, inputMode, maxLength, placeholder, value, error, onChange, onBlur }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type || 'text'}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        autoComplete="off"
      />
      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  );
}

export default function Login() {
  const { loginCitizen } = useApp();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (touched[name]) setErrors(validate(next));
  }

  function handleBlur(e) {
    const { name } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors(validate(form));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const allTouched = Object.fromEntries(Object.keys(EMPTY_FORM).map((k) => [k, true]));
    setTouched(allTouched);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length === 0) loginCitizen(form);
  }

  function fillDemo() {
    const m = MOCK_USERS.citizen;
    setForm({
      dni: m.dni,
      apellido_paterno: m.apellido_paterno,
      apellido_materno: m.apellido_materno,
      nombres: m.nombres,
      telefono: m.phone || '',
      email: m.email || '',
    });
    setErrors({});
    setTouched({});
  }

  const fieldProps = (id) => ({
    id,
    value: form[id],
    error: touched[id] && errors[id],
    onChange: handleChange,
    onBlur: handleBlur,
  });

  return (
    <div className={styles.container}>
      <div className={styles.bg} />

      <div className={`${styles.card} ${styles.cardForm}`}>
        <div className={styles.logoArea}>
          <div className={styles.shield}>
            <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.shieldSvg}>
              <path d="M24 2L4 10V26C4 38.15 12.8 49.46 24 53C35.2 49.46 44 38.15 44 26V10L24 2Z" fill="#003580" />
              <path d="M24 6L8 13V26C8 36.5 15.44 46.3 24 49.5C32.56 46.3 40 36.5 40 26V13L24 6Z" fill="#004bb5" />
              <path d="M20 27L17 24L15 26L20 31L33 18L31 16L20 27Z" fill="#c8a951" strokeWidth="0.5" stroke="#c8a951" />
            </svg>
          </div>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Denuncia Fácil</h1>
            <p className={styles.subtitle}>Policía Nacional del Perú</p>
          </div>
        </div>

        <div className={styles.divider} />

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.formGrid}>
            <div className={styles.colFull}>
              <Field {...fieldProps('dni')} label="DNI" required inputMode="numeric" maxLength={8} placeholder="12345678" />
            </div>
            <Field {...fieldProps('apellido_paterno')} label="Apellido paterno" required placeholder="López" />
            <Field {...fieldProps('apellido_materno')} label="Apellido materno" placeholder="Fernández" />
            <div className={styles.colFull}>
              <Field {...fieldProps('nombres')} label="Nombres" required placeholder="María Elena" />
            </div>
            <Field {...fieldProps('telefono')} label="Teléfono celular" inputMode="tel" placeholder="987654321" />
            <Field {...fieldProps('email')} label="Correo electrónico" type="email" placeholder="correo@ejemplo.com" />
          </div>

          <button type="submit" className={styles.submitBtn}>
            Ingresar
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>

        <button type="button" className={styles.demoLink} onClick={fillDemo}>
          Usar datos de demo
        </button>
      </div>
    </div>
  );
}
