"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } from "@/lib/auth-service";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function clear() { setError(null); setSuccess(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clear();
    setIsLoading(true);
    try {
      if (mode === "reset") {
        const { error } = await resetPassword(email);
        if (error) setError(error);
        else { setSuccess("E-mail de recuperação enviado!"); setMode("login"); }
        return;
      }
      const result = mode === "login"
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);
      if (result.error) setError(result.error);
      else router.push("/workspace");
    } finally { setIsLoading(false); }
  }

  async function handleGoogle() {
    clear();
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) setError(result.error);
      else router.push("/workspace");
    } finally { setIsGoogleLoading(false); }
  }

  const circles = [
    { size: 200, top: "2%",  left: "42%", opacity: 0.22 },
    { size: 140, top: "14%", left: "58%", opacity: 0.16 },
    { size: 110, top: "24%", left: "28%", opacity: 0.14 },
    { size: 170, top: "34%", left: "52%", opacity: 0.20 },
    { size: 95,  top: "46%", left: "34%", opacity: 0.12 },
    { size: 150, top: "54%", left: "60%", opacity: 0.18 },
    { size: 120, top: "64%", left: "24%", opacity: 0.15 },
    { size: 180, top: "72%", left: "48%", opacity: 0.20 },
    { size: 100, top: "84%", left: "36%", opacity: 0.13 },
    { size: 130, top: "90%", left: "56%", opacity: 0.16 },
  ];

  return (
    <div className="flex min-h-screen p-4">
      {/* Left panel */}
      <div className="relative hidden lg:flex lg:w-[52%] flex-col justify-between overflow-hidden p-12"
        style={{ background: "linear-gradient(135deg, #120800 0%, #08080A 50%, #0A0814 100%)" }}>
        
        {/* Ambient glow */}
        <div className="absolute left-1/3 top-1/3 h-64 w-64 rounded-2xl bg-[#E85D22]/8 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/3 h-48 w-48 rounded-2xl bg-[#5050F2]/6 blur-3xl" />

        {/* Floating circles */}
        {circles.map((c, i) => (
          <div key={i} className="absolute rounded-full border"
            style={{
              width: c.size, height: c.size,
              top: c.top, left: c.left,
              borderColor: `rgba(232, 93, 34, ${c.opacity})`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5050F2]">
            <span className="text-xs font-black text-white">G</span>
          </div>
          <span className="text-base font-bold text-white tracking-tight">Growfy</span>
        </div>

        {/* Headline */}
        <div className="relative z-10 space-y-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#5050f2]">LaunchOS</p>
          <h1 className="text-5xl font-semibold leading-[1.05] text-white">
            Inteligência<br />para seus<br />
            <span className="bg-gradient-to-r from-[#f7f8f8] to-[#a5a5a5] text-transparent bg-clip-text inline-block">lançamentos.</span>
          </h1>
          <p className="text-sm leading-relaxed text-white/35 max-w-xs">
            Centralize Meta Ads, Google Ads, Hotmart, Eduzz e Kiwify.
            Decisões com dados, não com achismos.
          </p>
        </div>

        {/* Stats */}
        <div className="relative z-10 flex gap-10">
          {[{ v: "5+", l: "Integrações" }, { v: "100%", l: "Tempo real" }, { v: "∞", l: "Simulações" }].map((s) => (
            <div key={s.l}>
              <p className="text-2xl font-black text-white">{s.v}</p>
              <p className="text-xs text-white/30 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-[#F7F7F8] px-8 py-12 lg:px-16 rounded-2xl">
        <div className="w-full max-w-[360px]">
          
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#5050F2]">
              <span className="text-xs font-black text-white">G</span>
            </div>
            <span className="font-bold text-[#08080A]">Growfy LaunchOS</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-[#08080A] tracking-tight">
              {mode === "login" && "Área de acesso"}
              {mode === "signup" && "Criar conta"}
              {mode === "reset" && "Recuperar senha"}
            </h2>
            <p className="mt-1 text-sm text-[#08080A]/40">
              {mode === "login" && "Bem-vindo de volta ao LaunchOS"}
              {mode === "signup" && "Comece gratuitamente hoje"}
              {mode === "reset" && "Enviaremos um link de recuperação"}
            </p>
          </div>

          {success && (
            <div className="mb-5 rounded-xl bg-[#00D861]/10 border border-[#00D861]/20 px-4 py-3">
              <p className="text-sm font-medium text-[#00D861]">{success}</p>
            </div>
          )}
          {error && (
            <div className="mb-5 rounded-xl bg-[#E85D22]/10 border border-[#E85D22]/20 px-4 py-3">
              <p className="text-sm font-medium text-[#E85D22]">{error}</p>
            </div>
          )}

          {mode !== "reset" && (
            <>
              <button type="button" onClick={handleGoogle} disabled={isGoogleLoading || isLoading}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#08080A]/10 bg-white px-4 py-3 mb-5 text-sm font-medium text-[#08080A] hover:bg-[#08080A]/4 transition-all disabled:opacity-50 shadow-sm">
                {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continuar com Google
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-[#08080A]/8" />
                <span className="text-xs text-[#08080A]/30 font-medium">ou</span>
                <div className="flex-1 h-px bg-[#08080A]/8" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#08080A]/50 mb-1.5">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@empresa.com" required autoComplete="email" disabled={isLoading}
                className="w-full rounded-xl border border-[#08080A]/10 bg-white px-4 py-3 text-sm text-[#08080A] placeholder:text-[#08080A]/25 outline-none transition-all focus:border-[#5050F2]/50 focus:ring-2 focus:ring-[#5050F2]/10 shadow-sm disabled:opacity-50" />
            </div>

            {mode !== "reset" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#08080A]/50">Senha</label>
                 
                </div>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    required minLength={6} disabled={isLoading}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="w-full rounded-xl border border-[#08080A]/10 bg-white px-4 py-3 pr-11 text-sm text-[#08080A] placeholder:text-[#08080A]/25 outline-none transition-all focus:border-[#5050F2]/50 focus:ring-2 focus:ring-[#5050F2]/10 shadow-sm disabled:opacity-50" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#08080A]/30 hover:text-[#08080A]/60">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  
                  
                </div>
                <div className="flex justify-end mt-2 mb-8">
                    {mode === "login" && (
                    <button type="button" onClick={() => { setMode("reset"); clear(); }}
                      className="text-xs font-semibold text-[#5050F2] hover:text-[#4040E0] transition-colors">
                      Esqueceu a senha?
                    </button>
                  )}

                  </div>
              </div>
            )}

            <button type="submit" disabled={isLoading || isGoogleLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#5050F2] px-4 py-3 mt-2 text-sm font-bold text-white hover:bg-[#4040E0] transition-all disabled:opacity-50 shadow-md">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" && "Entrar no Sistema"}
              {mode === "signup" && "Criar conta"}
              {mode === "reset" && "Enviar e-mail"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#08080A]/40">
            {mode === "login" && <>Não tem conta?{" "}<button onClick={() => { setMode("signup"); clear(); }} className="font-semibold text-[#5050F2] hover:text-[#4040E0] transition-colors">Criar conta</button></>}
            {mode === "signup" && <>Já tem conta?{" "}<button onClick={() => { setMode("login"); clear(); }} className="font-semibold text-[#5050F2] hover:text-[#4040E0] transition-colors">Entrar</button></>}
            {mode === "reset" && <button onClick={() => { setMode("login"); clear(); }} className="font-semibold text-[#5050F2] hover:text-[#4040E0] transition-colors">← Voltar para o login</button>}
          </p>
        </div>
      </div>
    </div>
  );
}