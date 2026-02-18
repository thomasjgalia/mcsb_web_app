import { Zap, PackageCheck, Loader2, CheckCircle, AlertCircle, FlaskConical } from 'lucide-react';

interface LandingProps {
  onSelectWorkflow: (workflow: 'direct' | 'hierarchical' | 'labtest') => void;
  connectionStatus: 'connecting' | 'connected' | 'error';
  errorMessage?: string;
}

export default function Landing({ onSelectWorkflow, connectionStatus, errorMessage = '' }: LandingProps) {

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        {/* Header + Connection Status */}
        <div className="text-center mb-6">
          <p className="text-lg text-gray-600 mb-3">
            What type of code set are you building?
          </p>
        <div>
          {connectionStatus === 'connecting' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Connecting to database...</span>
              </div>
              <p className="text-xs text-center text-blue-700">
                Initial connection may take a few minutes if the database is starting from a cold state.
              </p>
            </div>
          )}
          {connectionStatus === 'connected' && (
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">Database connected - Ready to build!</span>
            </div>
          )}
          {connectionStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-red-900">Connection Error</span>
              </div>
              <p className="text-xs text-center text-red-700">{errorMessage}</p>
            </div>
          )}
        </div>
        </div>

        {/* Workflow Selection Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Hierarchical Build Card */}
          <button
            onClick={() => onSelectWorkflow('hierarchical')}
            disabled={connectionStatus !== 'connected'}
            className="group relative bg-white rounded-lg border-2 border-gray-200 p-8 text-left transition-all hover:border-primary-500 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-none min-h-[580px] flex flex-col"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                <PackageCheck className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-1 leading-none mt-0">Hierarchical Build</h3>
                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                  Comprehensive
                </span>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              Build comprehensive code sets with all descendant concepts from the vocabulary hierarchy.
              Includes child concepts and related mappings.
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Works best for Condition and Drug domains</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Complete hierarchy with all descendants</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Explore relationships before building</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700">Workflow:</p>
              <p className="text-sm text-gray-500">Search → Explore Hierarchy → Build</p>
            </div>

            <div className="absolute bottom-4 right-4 text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-sm font-medium">Select →</span>
            </div>
          </button>

          {/* Direct Build Card */}
          <button
            onClick={() => onSelectWorkflow('direct')}
            disabled={connectionStatus !== 'connected'}
            className="group relative bg-white rounded-lg border-2 border-gray-200 p-8 text-left transition-all hover:border-primary-500 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-none min-h-[580px] flex flex-col"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                <Zap className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-1 leading-none mt-0">Direct Build</h3>
                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                  Fast & Precise
                </span>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              Build exact code sets from search results without hierarchical expansion.
              Returns only the specific concepts you select.
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Works best for Procedure, Measurement, Observation and Device domains</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Quick results - no hierarchy processing</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Precise control over included concepts</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700">Workflow:</p>
              <p className="text-sm text-gray-500">Search → Filter → Build</p>
            </div>

            <div className="absolute bottom-4 right-4 text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-sm font-medium">Select →</span>
            </div>
          </button>

          {/* Lab Test Build Card */}
          <button
            onClick={() => onSelectWorkflow('labtest')}
            disabled={connectionStatus !== 'connected'}
            className="group relative bg-white rounded-lg border-2 border-gray-200 p-8 text-left transition-all hover:border-primary-500 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-none min-h-[580px] flex flex-col"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                <FlaskConical className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-1 leading-none mt-0">Lab Test Build</h3>
                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                  Lab Focused
                </span>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              Build laboratory test code sets with detailed lab attributes.
              Includes LOINC, CPT4, HCPCS, and SNOMED lab codes with filtering.
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Optimized for Measurement domain</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Filter by Property, Scale, System, Time</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">Individual tests and panels</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700">Workflow:</p>
              <p className="text-sm text-gray-500">Search → Filter Labs → Build</p>
            </div>

            <div className="absolute bottom-4 right-4 text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-sm font-medium">Select →</span>
            </div>
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Not sure which to choose? Use <strong>Lab Test Build</strong> for laboratory measurements,
            <strong> Direct Build</strong> for simple lists, or <strong>Hierarchical Build</strong> for comprehensive clinical concept sets.
          </p>
        </div>
      </div>
    </div>
  );
}
