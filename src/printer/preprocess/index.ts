import { augmentWithCSSDisplay } from './augment-with-css-display';
import { augmentWithParent } from './augment-with-parent';
import { augmentWithSiblings } from './augment-with-siblings';
import { augmentWithWhitespaceHelpers } from './augment-with-whitespace-helpers';
import { augmentWithFamily } from './augment-with-family';

export * from './types';

export const AUGMENTATION_PIPELINE = [
  augmentWithParent,
  augmentWithSiblings,
  augmentWithFamily,
  augmentWithCSSDisplay,
  augmentWithWhitespaceHelpers,
];