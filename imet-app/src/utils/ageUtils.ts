export function isAdult(birthDate?: string): boolean {
  if (!birthDate) return true; // pas de date => adulte par défaut

  const birth = new Date(birthDate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());

  return hasHadBirthdayThisYear ? age >= 18 : (age - 1) >= 18;
}
