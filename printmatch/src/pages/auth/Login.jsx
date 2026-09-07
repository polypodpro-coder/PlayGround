import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export default function Login() {
  const navigate = useNavigate();
  const { quickLogin } = useApp();
  function enter(role) {
    quickLogin(role);
    navigate(role === "owner" ? "/owner" : "/");
  }
  return (
    <main className="flex flex-1 flex-col justify-center bg-navy px-6 py-10 text-white">
      <h1 className="text-2xl font-bold">Explore Poly Pod Pro</h1>
      <p className="mt-4 text-sm text-white/75">Use a sample account to explore the prototype. Real registration and sign-in are not available yet.</p>
      <div className="mt-8 space-y-3">
        <button className="btn-primary w-full" onClick={() => enter("buyer")}>Explore as a sample buyer</button>
        <button className="btn-primary w-full" onClick={() => enter("owner")}>Explore as a sample print farm</button>
      </div>
    </main>
  );
}
