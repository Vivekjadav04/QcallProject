import React, { createContext, useContext, useState, ReactNode } from 'react';
import CustomAlert from '../components/CustomAlert'; // Import your UI component

type AlertType = 'error' | 'success' | 'warning';

interface AlertContextType {
  showAlert: (title: string, message: string, type?: AlertType, onAction?: () => void) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<AlertType>('error');
  const [onAction, setOnAction] = useState<(() => void) | undefined>(undefined);

  const showAlert = (
    title: string, 
    message: string, 
    type: AlertType = 'error', 
    customAction?: () => void
  ) => {
    setTitle(title);
    setMessage(message);
    setType(type);
    setOnAction(() => customAction); // Store the custom action if provided
    setVisible(true);
  };

  const hideAlert = () => {
    setVisible(false);
    if (onAction) onAction(); // Execute callback if it exists
    setOnAction(undefined); // Reset action
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {/* The One Global Alert Instance */}
      <CustomAlert 
        visible={visible} 
        title={title} 
        message={message} 
        type={type} 
        onAction={hideAlert} 
        actionText="Okay"
      />
    </AlertContext.Provider>
  );
};

// Custom Hook to use it easily
export const useCustomAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useCustomAlert must be used within an AlertProvider');
  }
  return context;
};