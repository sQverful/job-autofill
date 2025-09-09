import '@src/Popup.css';
import { t } from '@extension/i18n';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, Button } from '@extension/ui';
import { AutofillControlPopup } from './components/AutofillControlPopup';

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);

  return (
    <div className="App">
      <AutofillControlPopup />
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
