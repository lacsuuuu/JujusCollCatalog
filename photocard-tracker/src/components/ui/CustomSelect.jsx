import { useState, useEffect, useRef } from 'react';

const CustomSelect = ({ value, onChange, options, placeholder, style, dark = false, direction = 'down' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = value ? (options.find(o => o.value === value)?.label ?? value) : placeholder;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', outline: 'none', boxSizing: 'border-box', ...style }}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(!isOpen); } }}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '0.5rem 2.5rem 0.5rem 0.75rem',
          borderRadius: '6px',
          backgroundColor: dark ? '#8D6E73' : '#C2B0B4',
          color: dark ? '#FFFFFF' : '#312527',
          fontSize: '0.85rem',
          cursor: 'pointer',
          backgroundImage: dark
            ? `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23FFFFFF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`
            : `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23312527' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
          backgroundSize: '1em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          boxSizing: 'border-box',
          width: '100%',
          fontWeight: dark ? '600' : 'normal',
        }}
      >
        {displayLabel}
      </div>

      {isOpen && (
        <div className="custom-scroll" style={{
          position: 'absolute',
          top: direction === 'down' ? '100%' : 'auto',
          bottom: direction === 'up' ? '100%' : 'auto',
          left: 0, right: 0, backgroundColor: '#F9F6F0',
          border: '1px solid #C2B0B4', borderRadius: '6px',
          marginTop: direction === 'down' ? '4px' : '0',
          marginBottom: direction === 'up' ? '4px' : '0',
          maxHeight: '180px', overflowY: 'auto', overflowX: 'hidden', zIndex: 999,
          boxShadow: '0 4px 16px rgba(49,37,39,0.15)', padding: '0.25rem 0'
        }}>
          {options.map((opt, i) => {
            const isActive = opt.value === value;
            const isHovered = hoveredIndex === i;
            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={(e) => { e.stopPropagation(); onChange(opt.value); setIsOpen(false); }}
                style={{
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  backgroundColor: isActive || isHovered ? '#8D6E73' : 'transparent',
                  color: isActive || isHovered ? '#FFFFFF' : '#312527',
                  fontWeight: isActive ? '600' : 'normal',
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;