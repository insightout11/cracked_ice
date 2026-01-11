import { useState, useEffect } from 'react';
import { Settings, Users, X } from 'lucide-react';

interface FirstTimeUserOverlayProps {
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenManage: () => void;
}

export function FirstTimeUserOverlay({ onClose, onOpenSettings, onOpenManage }: FirstTimeUserOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to Ice Level! 🏒',
      description: 'Let\'s get your roster optimizer set up in 2 easy steps.',
      icon: null,
      action: null,
      buttonText: 'Get Started',
    },
    {
      title: 'Step 1: Configure Your League',
      description: 'First, click Settings to input your league format and scoring categories. This ensures accurate projections.',
      icon: Settings,
      action: onOpenSettings,
      buttonText: 'Open Settings',
    },
    {
      title: 'Step 2: Add Your Players',
      description: 'Next, click Manage to add players to your roster. You can search manually or upload a screenshot of your roster.',
      icon: Users,
      action: onOpenManage,
      buttonText: 'Open Manage',
    },
  ];

  const step = steps[currentStep];

  const handleAction = () => {
    // Execute the current step's action (if any)
    if (step.action) {
      step.action();
    }

    // Advance to next step or close
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl shadow-2xl border border-cyan-500/30 w-full max-w-lg relative overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500" />

        {/* Content */}
        <div className="p-8 pt-12">
          {/* Icon */}
          {step.icon && (
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <step.icon className="w-8 h-8 text-cyan-400" />
            </div>
          )}

          {/* Title */}
          <h2 className="text-2xl font-bold text-white text-center mb-4">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-slate-300 text-center mb-8 leading-relaxed">
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-cyan-400 w-8'
                    : index < currentStep
                    ? 'bg-cyan-600'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 px-6 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors font-semibold"
            >
              Skip Tutorial
            </button>
            <button
              onClick={handleAction}
              className="flex-1 px-6 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-semibold"
            >
              {step.buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
