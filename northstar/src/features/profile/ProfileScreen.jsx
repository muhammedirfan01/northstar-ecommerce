import { validateProfilePhoto } from "./profilePhoto.js";
import { nameError } from "../../utils/nameValidation.js";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import API from "../../api/API.js";
import ProfileSidebar from "./ProfileSidebar.jsx";
import ProfileAddress from "./ProfileAddress.jsx";
import ProfileSecurityDialog from "./ProfileSecurityDialog.jsx";
import "./profile.css";
export default function ProfileScreen({
  editing = false,
  user,
  updateAccount,
}) {
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

  const photoRevision = useRef(0);
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  // Release the temporary photo preview when it is replaced or the page closes.
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);
  async function choosePhoto(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const revision = ++photoRevision.current;
    setPhoto(null);
    setPreview("");
    setCheckingPhoto(true);
    setError("");
    try {
      await validateProfilePhoto(file);
      if (revision !== photoRevision.current) return;
      setPhoto(file);
      setPreview(URL.createObjectURL(file));
    } catch (failure) {
      if (revision === photoRevision.current) setError(failure.message);
    } finally {
      if (revision === photoRevision.current) setCheckingPhoto(false);
    }
  }
  async function saveProfile(event) {
    event.preventDefault();
    if (checkingPhoto) return;
    const invalidName = nameError(name);
    if (invalidName) {
      setError(invalidName);
      return;
    }
    const form = new FormData();
    form.set("name", name.trim());
    form.set("phone", phone.trim());
    if (photo) {
      form.set("photo", photo);
    }
    setSaving(true);
    setError("");
    try {
      const response = await API.patch("/profile", form);
      const result = response.data.data;
      updateAccount(result.user);
      navigate("/profile", {
        replace: true,
        state: {
          notice: "Your profile has been saved.",
        },
      });
    } catch (error) {
      setError(error.response?.data?.message || error.message);
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
        <header className="account-page-heading">
          <h1>{editing ? "Edit Profile" : "My Profile"}</h1>
          <p>Manage your personal details and account security.</p>
        </header>
        {message && (
          <p className="account-save-notice" role="status">
            {message}
          </p>
        )}
        <div className="account-grid">
          <ProfileSidebar
            user={user}
            photo={preview || user.profileImage}
            editing={editing}
            disabled={saving || checkingPhoto}
            onPhotoChange={choosePhoto}
          />
          <section
            className="account-details"
            aria-labelledby="personal-details-heading"
          >
            <div className="account-card-heading">
              <h2 id="personal-details-heading">Personal details</h2>
            </div>
            <form
              className="account-details-form"
              onSubmit={saveProfile}
              aria-busy={saving}
            >
              <fieldset
                className="account-form-grid"
                disabled={saving || checkingPhoto}
              >
                <div className="account-field account-field-wide">
                  <label htmlFor="profile-name">Full name</label>
                  <input
                    id="profile-name"
                    value={editing ? name : user.name}
                    onChange={(event) => setName(event.target.value)}
                    readOnly={!editing}
                    autoComplete="name"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </div>
                <div className="account-field account-field-wide">
                  <label htmlFor="profile-phone">Contact phone number</label>
                  <input
                    id="profile-phone"
                    type="tel"
                    value={editing ? phone : user.phone || ""}
                    onChange={(event) => setPhone(event.target.value)}
                    readOnly={!editing}
                    autoComplete="tel"
                    maxLength={25}
                  />
                </div>
                <div className="account-field account-field-wide">
                  <label htmlFor="profile-email">Primary email address</label>
                  <div className="account-field-action">
                    <input
                      id="profile-email"
                      type="email"
                      value={user.email}
                      readOnly
                    />
                    {!user.isGoogleAccount && (
                      <button
                        className="account-inline-dark"
                        type="button"
                        onClick={() => setSecurity("email")}
                      >
                        Update email
                      </button>
                    )}
                  </div>
                </div>
                {!user.isGoogleAccount && (
                  <div className="account-field account-field-wide">
                    <span className="account-field-label">Password</span>
                    <div className="account-field-action">
                      <span className="account-password-placeholder">
                        {user.hasPassword ? "••••••" : "Not set"}
                      </span>
                      <button
                        className="account-inline-dark"
                        type="button"
                        onClick={() => setSecurity("password")}
                      >
                        {user.hasPassword ? "Update password" : "Set password"}
                      </button>
                    </div>
                  </div>
                )}
              </fieldset>
              {error && (
                <p className="account-form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="account-form-actions">
                {editing && !saving && (
                  <Link className="account-cancel" to="/profile">
                    Cancel
                  </Link>
                )}
                {editing && (
                  <button
                    className="account-primary"
                    type="submit"
                    disabled={saving || checkingPhoto}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                )}
                {!editing && (
                  <Link className="account-primary" to="/profile/edit">
                    Edit profile
                  </Link>
                )}
              </div>
            </form>
          </section>
        </div>
        {!editing && user.role === "customer" && <ProfileAddress />}
        {security && !user.isGoogleAccount && (
          <ProfileSecurityDialog
            kind={security}
            user={user}
            onUpdated={securityUpdated}
            onClose={() => setSecurity("")}
          />
        )}
      </main>
    </div>
  );
}
