export function isEmailDomainAllowed(email: string): boolean {
    const raw = process.env.ALLOWED_EMAIL_DOMAINS;
    if (!raw) return true;

    const allowed = raw.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (allowed.length === 0) return true;

    const domain = email.split('@')[1]?.toLowerCase();
    return !!domain && allowed.includes(domain);
}
