// src/lib/styles/forms.ts
export const FORM_STYLES = {
    layout: {
        leftAlign: -200,  // Single constant for left alignment
        fieldWidth: 400,  // Width of form fields
        buttonWidth: 150, // Width for the save button
        verticalSpacing: {
            betweenFields: 75,  // Space between each field group
            labelToInput: 10    // Space between label and its input
        }
    },
    inputs: {
        background: 'rgba(0, 0, 0, 0.9)',
        border: {
            default: '2px solid rgba(255, 255, 255, 0.3)',
            focus: '3px solid rgba(255, 255, 255, 0.8)',
            error: '2px solid #ff4444'
        },
        text: 'white',
        borderRadius: '4px',
        padding: '8px',
        font: {
            family: 'Orbitron',
            size: '0.9rem'
        },
        shadow: {
            focus: '0 0 0 1px rgba(255, 255, 255, 0.3)'
        }
    },
    buttons: {
        save: {
            background: 'rgba(74, 144, 226, 0.3)',
            border: '1px solid rgba(74, 144, 226, 0.4)',
            hoverBg: 'rgba(74, 144, 226, 0.4)'
        }
    },
    text: {
        label: {
            size: '14px',
            color: 'rgba(255, 255, 255, 0.7)'
        },
        characterCount: {
            size: '12px',
            color: 'rgba(255, 255, 255, 0.6)',
            warning: '#ffd700',
            error: '#ff4444'
        }
    }
};