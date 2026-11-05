import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./password-input.css";

export default function PasswordInput(props) {
  // Start with the password hidden.
  const [showPassword, setShowPassword] = useState(false);

  let inputType = "password";
  let buttonLabel = "Show password";
  let buttonIcon = <Eye size={18} aria-hidden="true" />;

  if (showPassword) {
    inputType = "text";
    buttonLabel = "Hide password";
    buttonIcon = <EyeOff size={18} aria-hidden="true" />;
  }

  function togglePassword() {
    setShowPassword(!showPassword);
  }

  return (
    <div className="password-input">
      {/* Pass the form's settings, such as name and required, to the input. */}
      <input {...props} type={inputType} />

      <button
        type="button"
        className="password-toggle"
        onClick={togglePassword}
        disabled={props.disabled}
        aria-label={buttonLabel}
        aria-pressed={showPassword}
        aria-controls={props.id}
      >
        {buttonIcon}
      </button>
    </div>
  );
}
