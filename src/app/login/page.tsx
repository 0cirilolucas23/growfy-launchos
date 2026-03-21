"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
} from "@/lib/auth-service";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Loader2, Chrome } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Mode = "login" | "signup" | "reset";

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function clearMessages() {
    setError(null);
    setSuccessMessage(null);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);

    try {
      if (mode === "reset") {
        const { error } = await resetPassword(email);
        if (error) {
          setError(error);
        } else {
          setSuccessMessage("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
          setMode("login");
        }
        return;
      }

      const result =
        mode === "login"
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(email, password);

      if (result.error) {
        setError(result.error);
      } else {
        router.push("/dashboard");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    clearMessages();
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/dashboard");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }

  const titles: Record<Mode, string> = {
    login: "Entrar na sua conta",
    signup: "Criar conta",
    reset: "Recuperar senha",
  };

  const buttonLabels: Record<Mode, string> = {
    login: "Entrar",
    signup: "Criar conta",
    reset: "Enviar e-mail",
  };

  return (
    <div className="flex min-h-screen bg-[#08080A]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-[#5050F2]/20 blur-3xl" />
        <div className="absolute right-0 bottom-1/4 h-64 w-64 rounded-full bg-[#00D861]/10 blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5050F2]">
            <span className="text-sm font-black text-white">G</span>
          </div>
          <span className="text-lg font-bold text-white">Growfy</span>
        </div>

        {/* Center content */}
        <div className="relative space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#5050F2]">
              LaunchOS
            </p>
            <h1 className="text-4xl font-black leading-tight text-white">
              Gerencie seus
              <br />
              lançamentos com
              <br />
              <span className="text-[#00D861]">inteligência.</span>
            </h1>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-white/50">
            Centralize métricas de Meta Ads, Hotmart, Eduzz e Kiwify em um só
            lugar. Calcule metas com engenharia reversa e tome decisões com dados.
          </p>

          {/* Stats */}
          <div className="flex gap-8">
            {[
              { value: "4+", label: "Integrações" },
              { value: "100%", label: "Dados em tempo real" },
              { value: "∞", label: "Simulações" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="text-xs text-white/40">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-xs text-white/20">
          © {new Date().getFullYear()} Growfy. Todos os direitos reservados.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5050F2]">
              <span className="text-xs font-black text-white">G</span>
            </div>
            <span className="font-bold text-white">Growfy LaunchOS</span>
          </div>

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-white">
              {titles[mode]}
            </h2>
            <p className="mt-1 text-sm text-white/40">
              {mode === "login" && "Bem-vindo de volta."}
              {mode === "signup" && "Comece gratuitamente hoje."}
              {mode === "reset" && "Enviaremos um link de recuperação."}
            </p>
          </div>

          {/* Success message */}
          {successMessage && (
            <div className="rounded-xl border border-[#00D861]/20 bg-[#00D861]/8 p-4">
              <p className="text-sm text-[#00D861]">{successMessage}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-xl border border-[#E85D22]/20 bg-[#E85D22]/8 p-4">
              <p className="text-sm text-[#E85D22]">{error}</p>
            </div>
          )}

          {/* Google button */}
          {mode !== "reset" && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-3 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isLoading}
            >
              {isGoogleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Chrome className="h-4 w-4" />
              )}
              Continuar com Google
            </Button>
          )}

          {/* Divider */}
          {mode !== "reset" && (
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-white/8" />
              <span className="text-xs text-white/30">ou use seu e-mail</span>
              <div className="flex-1 border-t border-white/8" />
            </div>
          )}

          {/* Email form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className={cn(
                  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3",
                  "text-sm text-white placeholder:text-white/25",
                  "outline-none transition-all",
                  "focus:border-[#5050F2]/60 focus:bg-white/8",
                  "disabled:opacity-50"
                )}
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            {mode !== "reset" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/60">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    minLength={6}
                    className={cn(
                      "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11",
                      "text-sm text-white placeholder:text-white/25",
                      "outline-none transition-all",
                      "focus:border-[#5050F2]/60 focus:bg-white/8",
                      "disabled:opacity-50"
                    )}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Forgot password */}
                {mode === "login" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setMode("reset"); clearMessages(); }}
                      className="text-xs text-white/40 hover:text-[#5050F2] transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full rounded-xl bg-[#5050F2] py-3 text-sm font-semibold text-white hover:bg-[#4040E0] disabled:opacity-50"
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                buttonLabels[mode]
              )}
            </Button>
          </form>

          {/* Mode switchers */}
          <div className="text-center text-sm text-white/40">
            {mode === "login" && (
              <>
                Não tem conta?{" "}
                <button
                  onClick={() => { setMode("signup"); clearMessages(); }}
                  className="font-medium text-[#5050F2] hover:text-[#7070FF] transition-colors"
                >
                  Criar conta
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Já tem conta?{" "}
                <button
                  onClick={() => { setMode("login"); clearMessages(); }}
                  className="font-medium text-[#5050F2] hover:text-[#7070FF] transition-colors"
                >
                  Entrar
                </button>
              </>
            )}
            {mode === "reset" && (
              <button
                onClick={() => { setMode("login"); clearMessages(); }}
                className="font-medium text-[#5050F2] hover:text-[#7070FF] transition-colors"
              >
                ← Voltar para o login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
