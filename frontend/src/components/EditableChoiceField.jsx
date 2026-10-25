import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';

const EditableChoiceField = ({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  testId,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listId = `${inputId}-options`;
  const blurTimeoutRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const normalizedValue = value.trim().toLocaleLowerCase();
  const filteredOptions = showAllOptions
    ? options
    : options.filter((option) =>
      option.toLocaleLowerCase().includes(normalizedValue),
    );
  const visibleOptions = filteredOptions;
  const keyboardOptions = isOpen && !showAllOptions ? visibleOptions : options;

  useEffect(() => () => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
    }
  }, []);

  const cancelPendingBlur = () => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  const chooseOption = (option) => {
    cancelPendingBlur();
    onChange(option);
    setIsOpen(false);
    setActiveIndex(-1);
    setShowAllOptions(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      setShowAllOptions(false);
      return;
    }

    if (event.key === 'ArrowDown' && keyboardOptions.length > 0) {
      event.preventDefault();
      if (!isOpen) setShowAllOptions(true);
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % keyboardOptions.length);
    } else if (event.key === 'ArrowUp' && keyboardOptions.length > 0) {
      event.preventDefault();
      if (!isOpen) setShowAllOptions(true);
      setIsOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? keyboardOptions.length - 1 : current - 1,
      );
    } else if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      event.preventDefault();
      chooseOption(keyboardOptions[activeIndex]);
    }
  };

  return (
    <div className="editable-choice-field">
      <Label htmlFor={inputId}>{label}</Label>
      <div className={`editable-choice-control${isOpen ? ' is-open' : ''}`}>
        <Input
          id={inputId}
          value={value}
          onChange={(event) => {
            cancelPendingBlur();
            onChange(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
            setShowAllOptions(false);
          }}
          onClick={() => {
            cancelPendingBlur();
            setIsOpen(true);
            setShowAllOptions(true);
            setActiveIndex(-1);
          }}
          onBlur={(event) => {
            if (event.currentTarget.parentElement?.contains(event.relatedTarget)) {
              return;
            }
            cancelPendingBlur();
            blurTimeoutRef.current = window.setTimeout(() => {
              setIsOpen(false);
              setActiveIndex(-1);
              setShowAllOptions(false);
              blurTimeoutRef.current = null;
            }, 250);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && visibleOptions.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          required
          data-testid={testId}
        />
        <button
          className="editable-choice-toggle"
          type="button"
          aria-label={`Show ${label.toLowerCase()} suggestions`}
          aria-expanded={isOpen}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            cancelPendingBlur();
            const opening = !isOpen;
            setIsOpen(opening);
            setShowAllOptions(opening);
            setActiveIndex(-1);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
        {isOpen && visibleOptions.length > 0 && (
          <div className="editable-choice-menu" id={listId} role="listbox">
            <p className="editable-choice-hint">
              Choose an option or keep typing
            </p>
            {visibleOptions.map((option, index) => (
              <button
                className={`editable-choice-option${index === activeIndex ? ' is-active' : ''}`}
                id={`${listId}-${index}`}
                key={option}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(option)}
                role="option"
                aria-selected={option === value}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableChoiceField;
