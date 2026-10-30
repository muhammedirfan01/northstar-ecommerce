import { nameError } from "../../utils/nameValidation.js";
import { useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AuthContext } from "../../context/AuthContext.js";
import { profileApi } from "../../api/profile.js";
import ProfileSidebar from "./ProfileSidebar.jsx";
import ProfileAddress from "./ProfileAddress.jsx";
import ProfileSecurityDialog from "./ProfileSecurityDialog.jsx";
import "./profile.css";

export default function ProfileScreen({ editing = false }) {
  const { user, updateAccount } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(location.state?.notice || "");
  const [security, setSecurity] = useState("");

  // Release the temporary photo preview when it is replaced or the page closes.
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  function choosePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError("Choose a JPG, PNG or WebP photo smaller than 2 MB.");
      return;
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setError("");
  }

  async function saveProfile(event) {
    event.preventDefault();
    const invalidName = nameError(name);
    if (invalidName) { setError(invalidName); return; }
    const form = new FormData();
    form.set("name", name.trim());
    form.set("phone", phone.trim());
    if (photo) form.set("photo", photo);
    setSaving(true);
    setError("");
    try {
      const result = await profileApi.save(form);
      updateAccount(result.user);
      navigate("/profile", { replace: true, state: { notice: "Your profile has been saved." } });
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  function securityUpdated(account, notice) {
    updateAccount(account);
    setMessage(notice);
  }

  return (
    <div className="account-shell">
      <main className="account-main">
        <header className="account-page-heading"><h1>{editing ? "Edit Profile" : "My Profile"}</h1><p>Manage your personal details and account security.</p></header>
        {message && <p className="account-save-notice" role="status">{message}</p>}
        <div className="account-grid">
          <ProfileSidebar user={user} photo={preview || user.profileImage} editing={editing} disabled={saving} onPhotoChange={choosePhoto} />
          <section className="account-details" aria-labelledby="personal-details-heading">
            <div className="account-card-heading"><h2 id="personal-details-heading">Personal details</h2></div>
            <form className="account-details-form" onSubmit={saveProfile} aria-busy={saving}>
              <fieldset className="account-form-grid" disabled={saving}>
                <div className="account-field account-field-wide">
                  <label htmlFor="profile-name">Full name</label>
                  <input id="profile-name" value={editing ? name : user.name} onChange={event => setName(event.target.value)} readOnly={!editing} autoComplete="name" minLength={2} maxLength={80} required />
                </div>
                <div className="account-field account-field-wide">
                  <label htmlFor="profile-phone">Contact phone number</label>
                  <input id="profile-phone" type="tel" value={editing ? phone : user.phone || ""} onChange={event => setPhone(event.target.value)} readOnly={!editing} autoComplete="tel" maxLength={25} />
                </div>
                <div className="account-field account-field-wide">
                  <label htmlFor="profile-email">Primary email address</label>
                  <div className="account-field-action"><input id="profile-email" type="email" value={user.email} readOnly />{!user.isGoogleAccount && <button className="account-inline-dark" type="button" onClick={() => setSecurity("email")}>Update email</button>}</div>
                </div>
                {!user.isGoogleAccount && <div className="account-field account-field-wide">
                  <span className="account-field-label">Password</span>
                  <div className="account-field-action"><span className="account-password-placeholder">{user.hasPassword ? "••••••" : "Not set"}</span><button className="account-inline-dark" type="button" onClick={() => setSecurity("password")}>{user.hasPassword ? "Update password" : "Set password"}</button></div>
                </div>}
              </fieldset>
              {error && <p className="account-form-error" role="alert">{error}</p>}
              <div className="account-form-actions">
                {editing && !saving && <Link className="account-cancel" to="/profile">Cancel</Link>}
                {editing && <button className="account-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>}
                {!editing && <Link className="account-primary" to="/profile/edit">Edit profile</Link>}
              </div>
            </form>
          </section>
        </div>
        {!editing && user.role === "customer" && <ProfileAddress />}
        {security && !user.isGoogleAccount && <ProfileSecurityDialog kind={security} user={user} onUpdated={securityUpdated} onClose={() => setSecurity("")} />}
      </main>
    </div>
  );
}
