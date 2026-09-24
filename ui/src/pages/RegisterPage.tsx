import { useState } from "react";
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';
import CardBanner from "../components/ui/CardBanner";
import Link from 'next/link';
import { useRouter } from 'next/router';
import { authService } from '../api/authService';
import { useAppDispatch } from '../store/hooks';
import { setCredentials } from '../store/slices/authSlice';
import Button from '../components/ui/Button';

export default function RegisterPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });


    const router = useRouter();
    const dispatch = useAppDispatch();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getFriendlyRegisterError = (error: unknown) => {
        if (!error || typeof error !== 'object') {
            return 'Unable to create your account right now. Please try again shortly.';
        }

        const apiError = error as { message?: string; status?: number };
        const message = apiError.message ?? '';

        if (apiError.status === 422) {
            if (message.toLowerCase().includes('email')) {
                return 'This email is already in use. Try signing in or use another email.';
            }
            return 'Please check your information and try again.';
        }

        if (message.toLowerCase().includes('already')) {
            return 'This email is already in use. Try signing in or use another email.';
        }

        return 'Unable to create your account right now. Please try again shortly.';
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const resp = await authService.register({
                name: formData.name,
                email: formData.email,
                password: formData.password,
            });

            // resp.data contains { user, token }
            dispatch(setCredentials({ user: resp.data.user, token: resp.data.token }));
            toast.success('Your account is ready. Welcome aboard!');

            // Redirect to protocol after successful register
            router.push('/');
        } catch (err) {
            toast.error(getFriendlyRegisterError(err));
            console.error('Registration failed', err);
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="min-h-screen w-full bg-white flex flex-col md:flex-row font-['Satoshi',_Helvetica,_sans-serif]">

            {/* MAIN COLUMN: Form Layout (Centered Content) */}
            <div className="w-full md:w-full flex flex-col justify-center items-center px-6 py-12 sm:px-12 lg:px-24 xl:px-32">
                <div className="w-full max-w-[400px] flex flex-col">

                    {/* Brand Logo Symbol */}
                    <CardBanner />

                    {/* Headers */}
                    <div className="text-center mb-8">
                        <h1 className="text-[28px] font-bold text-gray-900 tracking-tight mb-2">
                            Create an account
                        </h1>
                        <p className="text-[14px] text-gray-500 font-normal">
                            Get started by configuring your access profile below.
                        </p>
                    </div>

                    {/* Form Action */}
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Name Input */}
                        <div className="flex flex-col space-y-1.5">
                            <label className="text-[13px] font-semibold text-gray-700">
                                Full name <span className="text-red-500">*</span>
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#118451]">
                                    <User className="h-5 w-5 stroke-[1.5]" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter your full name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#118451] focus:ring-1 focus:ring-[#118451] transition-all duration-150"
                                />
                            </div>
                        </div>

                        {/* Email Input */}
                        <div className="flex flex-col space-y-1.5">
                            <label className="text-[13px] font-semibold text-gray-700">
                                Email address <span className="text-red-500">*</span>
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#118451]">
                                    <Mail className="h-5 w-5 stroke-[1.5]" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    placeholder="Enter your email address"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#118451] focus:ring-1 focus:ring-[#118451] transition-all duration-150"
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
                                    placeholder="Create a secure password"
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
                        <div className="pt-2">
                            <Button type="submit" isLoading={isSubmitting} loadingText="Creating account..." fullWidth>
                                Sign up
                            </Button>
                        </div>
                    </form>

                    {/* Alternate Redirection link */}
                    <p className="text-center text-[14px] text-gray-600 mt-8">
                        Already have an account?{' '}
                        <Link href="/login" className="font-bold text-[#18ac6a] hover:text-[#118451] transition-colors">
                            Sign in
                        </Link>
                    </p>

                </div>
            </div>

        </div>
    );
}
