import React from 'react';
import { useRouter } from 'next/router';
import Button from '../ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const LoginRequiredModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const router = useRouter();

  if (!isOpen) return null;

  const handleLogin = () => {
    // preserve current location so user can be returned after login
    router.push('/login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-bold text-gray-900">Sign in to continue</h3>
        <p className="text-sm text-gray-600 mt-2">You need to be signed in to perform this action.</p>

        <div className="mt-5 flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleLogin}>Login</Button>
        </div>
      </div>
    </div>
  );
};

export default LoginRequiredModal;
