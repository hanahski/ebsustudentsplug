declare module "react-book-reader" {
  import type { ComponentType, ReactElement } from "react";
  export interface ReactReaderProps {
    url: string | File;
    title?: string | ReactElement;
    location?: string | number;
    showToc?: boolean;
    locationChanged?: (loc: string) => void;
    tocChanged?: (toc: unknown) => void;
    getRendition?: (rendition: unknown) => void;
    LoadingView?: ReactElement;
    ErrorView?: ReactElement;
    [key: string]: unknown;
  }
  export const ReactReader: ComponentType<ReactReaderProps>;
  export const EpubView: ComponentType<ReactReaderProps>;
}
