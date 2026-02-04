import { Clock, Mail, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PendingApprovalPageProps {
  email: string;
}

export default function PendingApprovalPage({ email }: PendingApprovalPageProps) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const isVeradigmEmail = email.endsWith('@veradigm.me');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-yellow-100 p-3">
              <Clock className="w-12 h-12 text-yellow-600" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">
            Approval Pending
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Signed in as:
                </p>
                <p className="text-sm text-blue-800 font-semibold break-all">
                  {email}
                </p>
              </div>
            </div>
          </div>

          {isVeradigmEmail ? (
            <>
              <p className="text-center text-gray-600 mb-4">
                Your <strong>@veradigm.me</strong> account should be automatically approved.
              </p>
              <p className="text-sm text-center text-gray-500 mb-6">
                If you continue to see this message, please contact your system administrator.
              </p>
            </>
          ) : (
            <>
              <p className="text-center text-gray-600 mb-4">
                Your account is awaiting administrator approval.
              </p>
              <p className="text-sm text-center text-gray-500 mb-6">
                Access is typically granted to <strong>@veradigm.me</strong> email addresses.
                External users require manual approval. You'll receive an email once your account is approved.
              </p>
            </>
          )}

          <div className="border-t border-gray-200 pt-6">
            <button
              onClick={handleSignOut}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Need help? Contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
