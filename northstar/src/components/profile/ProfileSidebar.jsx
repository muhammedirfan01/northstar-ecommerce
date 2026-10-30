import { Link } from "react-router";
import ProfileAvatar from "../ProfileAvatar.jsx";

export default function ProfileSidebar({ user, photo, editing, disabled, onPhotoChange }) {
  return (
    <aside className="account-summary" aria-label="Account summary">
      <div className="account-summary-heading">
        <div className="account-avatar" id="profile-photo"><ProfileAvatar user={{ name: user.name, profileImage: photo }} /></div>
        <h2>{user.name}</h2>
      </div>
      <div className="account-photo-action">
        {editing && <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a profile photo" disabled={disabled} onChange={onPhotoChange} />}
        {editing && <small>JPG, PNG or WebP. Maximum 2 MB.</small>}
        {!editing && <Link to="/profile/edit">Change photo</Link>}
      </div>
      <dl className="account-summary-details">
        <div><dt>Registered email</dt><dd>{user.email}</dd></div>
        <div><dt>Contact phone</dt><dd>{user.phone || "Not added"}</dd></div>
        <div><dt>Email status</dt><dd>{user.isEmailVerified ? "Email address verified" : "Email verification required"}</dd></div>
      </dl>
    </aside>
  );
}
