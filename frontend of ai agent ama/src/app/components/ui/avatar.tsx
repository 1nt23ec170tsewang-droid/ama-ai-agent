import * as React from 'react';
import { useAuth } from '../../context/AuthContext';

interface AvatarProps {
  email?: string;
  name?: string;
  photoURL?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | number;
}

export function Avatar({ email, name, photoURL, className = '', size = 'md' }: AvatarProps) {
  const { user } = useAuth();
  const [imageError, setImageError] = React.useState(false);

  // Reset error state if image source changes
  React.useEffect(() => {
    setImageError(false);
  }, [photoURL, email, user?.photoURL]);

  // Priority Logic:
  // 1. If email matches the logged-in user's email, prioritize user.photoURL from AuthContext
  const isCurrentUser = email && user?.email && email.toLowerCase().trim() === user.email.toLowerCase().trim();
  const activePhotoURL = isCurrentUser ? (user?.photoURL || photoURL) : photoURL;

  // Derive initials
  const getInitials = () => {
    const displayName = isCurrentUser ? (user?.name || name || email || '') : (name || email || '');
    if (!displayName) return 'R';
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  // Derive size styling
  let sizeClass = 'w-10 h-10 text-sm';
  let sizeStyle: React.CSSProperties = {};

  if (typeof size === 'number') {
    sizeStyle = { width: size, height: size, fontSize: Math.max(10, Math.floor(size / 2.5)) };
    sizeClass = '';
  } else if (size === 'sm') {
    sizeClass = 'w-8 h-8 text-xs';
  } else if (size === 'lg') {
    sizeClass = 'w-16 h-16 text-xl';
  }

  // Render Image
  if (activePhotoURL && !imageError) {
    return (
      <img
        src={activePhotoURL}
        alt={name || email || 'User Avatar'}
        onError={() => setImageError(true)}
        className={`rounded-full object-cover select-none shrink-0 ${sizeClass} ${className}`}
        style={sizeStyle}
      />
    );
  }

  // Fallback Initials Badge
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white select-none shrink-0 ${sizeClass} ${className}`}
      style={{
        backgroundColor: '#FF6B00',
        ...sizeStyle
      }}
    >
      {getInitials()}
    </div>
  );
}
