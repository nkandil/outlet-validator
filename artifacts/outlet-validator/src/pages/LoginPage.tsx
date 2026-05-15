import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Alert, Button, Field, Input, Panel } from "../components/ui";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-8">
      <Panel className="w-full max-w-md p-6">
        <form className="grid gap-5" onSubmit={submit}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Outlet Validator</h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">Sign in to continue</p>
          </div>
          <Field label="Email">
            <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" disabled={!email.trim() || !password}>
            Sign In
          </Button>
        </form>
      </Panel>
    </main>
  );
}
