import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface IceDropdownProps {
  options: DropdownOption[];
  value?: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export const IceDropdown: React.FC<IceDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  'aria-label': ariaLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isClosing, setIsClosing] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  // Close dropdown when clicking outside or update position on scroll
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    const handleScroll = () => {
      if (buttonRef.current && isOpen) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    };

    const handleResize = () => {
      if (isOpen) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true); // Use capture phase to catch all scroll events
      window.addEventListener('resize', handleResize);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [options]);

  const openDropdown = () => {
    if (!disabled && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
      setIsOpen(true);
      setIsClosing(false);
      setHighlightedIndex(-1);
    }
  };

  const closeDropdown = () => {
    if (isOpen) {
      setIsClosing(true);
      // Wait for animation to complete before actually closing
      setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
        setHighlightedIndex(-1);
        buttonRef.current?.focus();
      }, 200);
    }
  };

  const toggleDropdown = () => {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  const selectOption = (optionValue: string | number) => {
    onChange(optionValue);
    closeDropdown();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          openDropdown();
        } else if (highlightedIndex >= 0) {
          const option = options[highlightedIndex];
          if (!option.disabled) {
            selectOption(option.value);
          }
        }
        break;
      
      case 'Escape':
        if (isOpen) {
          event.preventDefault();
          closeDropdown();
        }
        break;
      
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          openDropdown();
        } else {
          const nextIndex = Math.min(highlightedIndex + 1, options.length - 1);
          setHighlightedIndex(nextIndex);
        }
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          const prevIndex = Math.max(highlightedIndex - 1, 0);
          setHighlightedIndex(prevIndex);
        }
        break;
      
      case 'Home':
        if (isOpen) {
          event.preventDefault();
          setHighlightedIndex(0);
        }
        break;
      
      case 'End':
        if (isOpen) {
          event.preventDefault();
          setHighlightedIndex(options.length - 1);
        }
        break;
    }
  };

  const getOptionId = (index: number) => `ice-dropdown-option-${index}`;
  const dropdownId = `ice-dropdown-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`ice-dropdown ${className}`} ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        className="ice-dropdown-button"
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={dropdownId}
        aria-label={ariaLabel}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 
            ? getOptionId(highlightedIndex) 
            : undefined
        }
      >
        <span className="ice-dropdown-selected">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="ice-dropdown-arrow" />
      </button>

      {isOpen && createPortal(
        <div
          ref={optionsRef}
          className={`ice-dropdown-options ${isClosing ? 'closing' : ''}`}
          role="listbox"
          aria-labelledby={dropdownId}
          tabIndex={-1}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 99999
          }}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={getOptionId(index)}
              className={`ice-dropdown-option ${
                option.value === value ? 'selected' : ''
              } ${
                index === highlightedIndex ? 'highlighted' : ''
              } ${
                option.disabled ? 'disabled' : ''
              }`}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled}
              onClick={() => !option.disabled && selectOption(option.value)}
              onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
            >
              {option.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};