import { useState } from "react";
import { profileImageUrl } from "../api/auth.js";

export default function ProfileAvatar({ user }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = profileImageUrl(user?.profileImage);
  const name = user?.name || "Northstar member";

  return (
    <span className="user-avatar" aria-hidden="true">
      {source && source !== failedSource ? (
        <img src={source} alt="" referrerPolicy="no-referrer" onError={() => setFailedSource(source)} />
      ) : profileInitials(name)}
    </span>
  );
}

function profileInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "NS";
}

