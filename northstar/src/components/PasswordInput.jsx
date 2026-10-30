import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./password-input.css";

export default function PasswordInput({ id, disabled, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <input {...props} id={id} type={visible ? "text" : "password"} disabled={disabled} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
