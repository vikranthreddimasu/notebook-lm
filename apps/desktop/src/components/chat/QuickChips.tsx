import './chat.css';

interface QuickChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
}

export function QuickChips({ chips, onSelect }: QuickChipsProps) {
  return (
    <div className="quick-chips">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          className="quick-chip"
          onClick={() => onSelect(chip)}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
