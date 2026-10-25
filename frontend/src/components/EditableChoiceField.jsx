import { useId, useState } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedValue = value.trim().toLocaleLowerCase();
  const filteredOptions = options.filter((option) =>
    option.toLocaleLowerCase().includes(normalizedValue),
  );
  const visibleOptions = filteredOptions;

  const chooseOption = (option) => {
    onChange(option);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === 'ArrowDown' && visibleOptions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % visibleOptions.length);
    } else if (event.key === 'ArrowUp' && visibleOptions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? visibleOptions.length - 1 : current - 1,
      );
    } else if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      event.preventDefault();
      chooseOption(visibleOptions[activeIndex]);
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
            onChange(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onClick={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
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
          onClick={() => setIsOpen((open) => !open)}
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
