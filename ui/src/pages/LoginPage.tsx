import { useState } from "react";
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { useAppDispatch } from '../store/hooks';
import { authService } from '../api/authService';
import { setCredentials } from '../store/slices/authSlice';
import BrandCheckbox from "../components/ui/BrandCheckbox";
import CardBanner from "../components/ui/CardBanner";
import Button from '../components/ui/Button';
import Link from 'next/link';

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [formData, setFormData] = useState({ email: '', password: '' });

    const router = useRouter();
    const dispatch = useAppDispatch();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getFriendlyLoginError = (error: unknown) => {
        if (!error || typeof error !== 'object') {
            return 'Unable to sign in right now. Please try again shortly.';
        }

        const apiError = error as { message?: string; status?: number };
        const message = apiError.message ?? '';

        if (apiError.status === 422) {
            return 'Please check your email and password and try again.';
        }

        const normalizedMessage = message.toLowerCase();
        if (normalizedMessage.includes('credentials') || normalizedMessage.includes('invalid')) {
            return 'Email or password is incorrect. Please try again.';
        }

        return 'Unable to sign in right now. Please try again shortly.';
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const resp = await authService.login({
                email: formData.email,
                password: formData.password,
            });

            // resp.data contains { user, token }
            dispatch(setCredentials({ user: resp.data.user, token: resp.data.token }));
            toast.success('Signed in successfully. Welcome back!');

            // Redirect to home after successful login
            router.push('/');
        } catch (err) {
            toast.error(getFriendlyLoginError(err));
            console.error('Login failed', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-white flex flex-col md:flex-row font-['Satoshi',_Helvetica,_sans-serif]">

            <div className="w-full md:w-full flex flex-col justify-center items-center px-6 py-12 sm:px-12 lg:px-24 xl:px-32">
                <div className="w-full max-w-[400px] flex flex-col">

                    {/* Brand Logo Symbol */}
                    <CardBanner />

                    {/* Headers */}
                    <div className="text-center mb-8">
                        <h1 className="text-[28px] font-bold text-gray-900 tracking-tight mb-2">
                            Welcome back
                        </h1>
                        <p className="text-[14px] text-gray-500 font-normal">
                            Welcome back! Please enter your details.
                        </p>
                    </div>

                    {/* Form Action */}
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Email/Username Input */}
                        <div className="flex flex-col space-y-1.5">
                            <label className="text-[13px] font-semibold text-gray-700">
                                Email or username <span className="text-red-500">*</span>
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#118451]">
                                    <Mail className="h-5 w-5 stroke-[1.5]" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter your email or username"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#118451] focus:ring-1 focus:ring-[#118451] transition-all duration-150 visual-border-hierarchy"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="flex flex-col space-y-1.5">
                            <label className="text-[13px] font-semibold text-gray-700">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#118451]">
                                    <Lock className="h-5 w-5 stroke-[1.5]" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="Enter your password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#118451] focus:ring-1 focus:ring-[#118451] transition-all duration-150"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5 stroke-[1.5]" />
                                    ) : (
                                        <Eye className="h-5 w-5 stroke-[1.5]" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me & Forgot Password Utilities */}
                        <div className="flex items-center justify-between pt-1">
                            <BrandCheckbox
                                checked={rememberMe}
                                onChange={() => setRememberMe(!rememberMe)}
                                label="Remember for 30 days"
                            />
                            {/* <a
                                href="#forgot"
                                className="text-[13px] font-bold text-[#118451] hover:text-[#065c38] transition-colors"
                            >
                                Forgot password
                            </a> */}
                        </div>

                        {/* Primary Action Button (Strictly 2rem pill border-radius) */}
                        <div className="pt-2">
                            <Button type="submit" isLoading={isSubmitting} loadingText="Signing in..." fullWidth>
                                Sign in
                            </Button>
                        </div>
                    </form>

                    {/* Alternate Redirection link */}
                    <p className="text-center text-[14px] text-gray-600 mt-8">
                        Don't have an account?{' '}
                        <Link href="/register" className="font-bold text-[#18ac6a] hover:text-[#118451] transition-colors">
                            Sign up
                        </Link>
                    </p>

                </div>
            </div>


        </div>
    );
}
