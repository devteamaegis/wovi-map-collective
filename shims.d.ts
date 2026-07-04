// nodemailer is an OPTIONAL runtime dependency (dynamically imported only when
// SMTP_* env vars are set — see lib/repos/settings.ts). This ambient declaration
// lets the project type-check without the package installed. To enable real
// email delivery: `npm install nodemailer` and set SMTP_HOST / SMTP_FROM.
declare module "nodemailer";
