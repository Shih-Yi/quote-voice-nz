"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface EditSentQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVersion: number;
  onCreateNewVersion: () => void;
  onEditOriginal: () => void;
  versionLimitReached?: boolean;
}

export function EditSentQuoteDialog({
  open,
  onOpenChange,
  currentVersion,
  onCreateNewVersion,
  onEditOriginal,
  versionLimitReached = false,
}: EditSentQuoteDialogProps) {
  const nextVersion = currentVersion + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            This quote was already sent
          </DialogTitle>
          <DialogDescription className="pt-2 text-text-muted">
            Would you like to create a new version (V{nextVersion}) to keep your history,
            or just update the original one?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          {versionLimitReached ? (
            <a
              href="/pricing"
              className="flex items-center justify-center gap-2 w-full rounded-md border border-primary/20 bg-primary/5 py-3 text-sm text-primary hover:bg-primary/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Version limit reached — Upgrade to Pro for unlimited
            </a>
          ) : (
            <Button
              onClick={() => {
                onCreateNewVersion();
                onOpenChange(false);
              }}
              className="w-full bg-primary hover:bg-primary-dark"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Create New Version (V{nextVersion})
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => {
              onEditOriginal();
              onOpenChange(false);
            }}
            className="w-full text-text-muted hover:text-text"
          >
            Edit Original
          </Button>
        </div>

        <p className="text-xs text-text-muted text-center mt-2">
          {versionLimitReached
            ? "You can still edit the original quote directly"
            : "Creating a new version is recommended to maintain a clear history"}
        </p>
      </DialogContent>
    </Dialog>
  );
}
