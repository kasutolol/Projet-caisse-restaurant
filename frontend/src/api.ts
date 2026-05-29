export const API = process.env.EXPO_PUBLIC_BACKEND_URL + "/api";

export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  aperitifs_tapas: { bg: "#FFEDD5", border: "#F97316", text: "#7C2D12" },
  entrees: { bg: "#ECFCCB", border: "#84CC16", text: "#3F6212" },
  plats: { bg: "#FEE2E2", border: "#EF4444", text: "#7F1D1D" },
  vins: { bg: "#FFE4E6", border: "#E11D48", text: "#881337" },
  boissons: { bg: "#E0F2FE", border: "#0EA5E9", text: "#0C4A6E" },
  desserts: { bg: "#FAE8FF", border: "#D946EF", text: "#701A75" },
  cafes_digestifs: { bg: "#FEF3C7", border: "#D97706", text: "#78350F" },
};

export const COLORS = {
  bg: "#F4F4F5",
  surface: "#FFFFFF",
  text: "#09090B",
  textSecondary: "#52525B",
  border: "#E4E4E7",
  primary: "#0055FF",
  primaryDark: "#003399",
  success: "#22C55E",
  successBg: "#DCFCE7",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  danger: "#EF4444",
};

export async function api(path: string, init?: RequestInit) {
  const res = await fetch(API + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${path}: ${res.status} ${txt}`);
  }
  return res.json();
}

export function fmtPrice(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}
