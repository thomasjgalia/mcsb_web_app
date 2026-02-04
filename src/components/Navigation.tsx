import { Search, GitBranch, PackageCheck, ChevronRight, ShoppingCart, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// import AIChatAssistant from './AIChatAssistant';
// import UMLSSearch from './UMLSSearch';

interface NavigationProps {
  currentStep: 0 | 1 | 2 | 3;
  workflow: 'direct' | 'hierarchical' | 'labtest' | null;
  onStepClick: (step: 0 | 1 | 2 | 3) => void;
  cartItemCount: number;
  onCartClick: () => void;
  onStartOver: () => void;
}

export default function Navigation({ currentStep, workflow, onStepClick, cartItemCount, onCartClick, onStartOver }: NavigationProps) {
  const navigate = useNavigate();

  // Define steps based on workflow
  const allSteps = [
    {
      number: 1,
      title: 'Search',
      icon: Search,
      path: '/search',
      description: 'Find medical concepts',
    },
    {
      number: 2,
      title: 'Hierarchy',
      icon: GitBranch,
      path: '/hierarchy',
      description: 'Explore relationships',
    },
    {
      number: 3,
      title: 'Build Code Set',
      icon: PackageCheck,
      path: '/codeset',
      description: 'Generate results',
    },
  ];

  // Filter steps based on workflow
  const steps = (workflow === 'direct' || workflow === 'labtest')
    ? allSteps.filter(step => step.number !== 2) // Skip hierarchy for direct and labtest workflows
    : allSteps;

  const handleStepClick = (step: typeof steps[0]) => {
    onStepClick(step.number as 0 | 1 | 2 | 3);
    navigate(step.path);
  };

  // Get workflow badge text and color
  const getWorkflowBadge = () => {
    if (workflow === 'hierarchical') {
      return { text: 'Hierarchical Build', color: 'bg-blue-100 text-blue-800' };
    } else if (workflow === 'direct') {
      return { text: 'Direct Build', color: 'bg-green-100 text-green-800' };
    } else if (workflow === 'labtest') {
      return { text: 'Lab Test Build', color: 'bg-purple-100 text-purple-800' };
    }
    return null;
  };

  const workflowBadge = getWorkflowBadge();

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2">
          {/* Workflow Badge */}
          {workflowBadge && (
            <div className="mr-3">
              <span className={`px-2 py-1 rounded-md text-xs font-semibold ${workflowBadge.color}`}>
                {workflowBadge.text}
              </span>
            </div>
          )}

          {/* Step Navigation */}
          <div className="flex items-center space-x-2 overflow-x-auto flex-1">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <button
                  onClick={() => handleStepClick(step)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all
                    ${
                      currentStep === step.number
                        ? 'bg-primary-50 text-primary-700 shadow-sm'
                        : currentStep > step.number
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }
                  `}
                >
                  {/* Step Icon */}
                  <div
                    className={`
                      flex items-center justify-center w-6 h-6 rounded-full
                      ${
                        currentStep === step.number
                          ? 'bg-primary-600 text-white'
                          : currentStep > step.number
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }
                    `}
                  >
                    <step.icon className="w-3 h-3" />
                  </div>

                  {/* Step Info */}
                  <div className="text-left">
                    <div className="text-xs font-semibold">{step.title}</div>
                  </div>
                </button>

                {/* Chevron between steps */}
                {index < steps.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                )}
              </div>
            ))}
          </div>

          {/* Home Button, AI Assistant & UMLS Search */}
          <div className="ml-3 flex items-center gap-2">
            <button
              onClick={onStartOver}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1.5 text-gray-700 hover:text-primary-600"
              title="Return to home and start over"
            >
              <Home className="w-5 h-5" />
              <span className="text-xs font-medium">Home</span>
            </button>
            {/* <AIChatAssistant /> */}
            {/* <UMLSSearch /> */}
          </div>

          {/* Shopping Cart Button */}
          <button
            onClick={onCartClick}
            className="relative ml-3 p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2 text-gray-700 hover:text-primary-600"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
