import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export default function MultiSelect({ options, selected = [], onChange, placeholder = 'Select options...' }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleOption = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const selectedLabels = options
    .filter(opt => selected.includes(opt.value))
    .map(opt => opt.label)

  const displayText = selectedLabels.length === 0
    ? placeholder
    : selectedLabels.length <= 2
      ? selectedLabels.join(', ')
      : `${selectedLabels.length} selected`

  return (
    <div className="multiselect-container" ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="filter-select"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          textAlign: 'left',
          background: 'var(--c-surface-2)',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-md)',
          color: selected.length > 0 ? 'var(--c-text)' : 'var(--c-text-3)',
          padding: 'var(--space-2) var(--space-4)',
          fontSize: '12.5px',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
          {displayText}
        </span>
        <ChevronDown size={14} color="var(--c-text-3)" />
      </button>

      {isOpen && (
        <div
          className="multiselect-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            marginTop: '4px',
            background: '#1A110C',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-md)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            padding: '8px 0',
            minWidth: '200px',
            maxHeight: '260px',
            overflowY: 'auto'
          }}
        >
          {options.map(opt => {
            const isChecked = selected.includes(opt.value)
            return (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  color: 'var(--c-text-2)',
                  cursor: 'pointer',
                  transition: 'background var(--t-fast)'
                }}
                className="multiselect-option"
                onMouseEnter={e => e.currentTarget.style.background = '#2E1E14'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleOption(opt.value)}
                  style={{
                    cursor: 'pointer',
                    accentColor: 'var(--c-accent)'
                  }}
                />
                <span style={{ color: isChecked ? 'var(--c-accent)' : 'var(--c-text-2)' }}>
                  {opt.label}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
