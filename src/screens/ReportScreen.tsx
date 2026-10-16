import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Screen, ReportItem, SelectedLocation } from '../types';
import { LocationPickerMap } from '../components/LocationPickerMap';
import {
  reverseGeocodeCoordinates,
  formatGeolocationError,
} from '../utils/geo';

interface ReportScreenProps {
  onNavigate: (screen: Screen, direction?: 'forward' | 'back', reportId?: string) => void;
  onAddReport: (report: ReportItem, file?: File | null) => Promise<ReportItem>;
  onOpenInfoModal: (title: string, content: string) => void;
  prefilledLocation?: SelectedLocation | null;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  onNavigate,
  onAddReport,
  onOpenInfoModal,
  prefilledLocation,
}) => {
  // Form State: actual File object and object URL preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoSelected, setPhotoSelected] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('No photo selected');
  const [fileSize, setFileSize] = useState<string>('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const previewUrlRef = useRef<string | null>(null);
  const submissionStartedRef = useRef(false);

  const [locationMode, setLocationMode] = useState<'manual' | 'detect'>('manual');
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [reportLat, setReportLat] = useState<number | null>(null);
  const [reportLng, setReportLng] = useState<number | null>(null);
  const [landmark, setLandmark] = useState<string>('');
  const [locationNotes, setLocationNotes] = useState<string>('');

  // GPS Accuracy & Status State
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<{
    type: 'idle' | 'locating' | 'success' | 'error' | 'manual';
    title?: string;
    message?: string;
    code?: string;
  }>({
    type: 'idle',
    title: 'Location Ready',
    message: 'Choose a location on the map or use your current location. Enter the ward or area and a nearby landmark.',
  });

  const [wasteCategory, setWasteCategory] = useState<string>('overflowing-bin');
  const [severity, setSeverity] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [consentGiven, setConsentGiven] = useState<boolean>(false);

  // Submission & Stepper State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionStepText, setSubmissionStepText] = useState<string>('');
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [generatedRefId, setGeneratedRefId] = useState<string>('');
  const [createdReport, setCreatedReport] = useState<ReportItem | null>(null);

  // Diagnostics State
  const [diagnosticToast, setDiagnosticToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const postCardRef = useRef<HTMLDivElement>(null);

  // Revoke obsolete object URL on unmount to prevent browser memory leaks
  useEffect(() => {
    return () => {
      if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  // Apply a location selected from another screen when provided.
  useEffect(() => {
    if (prefilledLocation) {
      setReportLat(prefilledLocation.lat);
      setReportLng(prefilledLocation.lng);
      setGpsAccuracy(null);
      if (prefilledLocation.ward) {
        setSelectedWard(prefilledLocation.ward);
      }
      if (prefilledLocation.landmark) {
        setLandmark(prefilledLocation.landmark);
      }
      setGpsStatus({
        type: 'manual',
        title: 'Map Spot Applied',
        message: `Selected coordinates: ${prefilledLocation.lat.toFixed(4)}, ${prefilledLocation.lng.toFixed(4)}.`,
      });
      setDiagnosticToast(`Map pin coordinates imported: ${prefilledLocation.lat.toFixed(4)}° N, ${prefilledLocation.lng.toFixed(4)}° E`);
    }
  }, [prefilledLocation]);

  // Validate and process the actual photo file
  const validateAndProcessPhoto = useCallback((file: File): boolean => {
    // 1. Validate permitted image MIME types
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const hasValidMime =
      validMimes.includes(file.type.toLowerCase()) ||
      /\.(jpe?g|png|webp)$/i.test(file.name);

    if (!hasValidMime) {
      setPhotoError('Invalid image format: Please upload a JPEG, PNG, or WebP photo.');
      setDiagnosticToast('Unsupported image format. Use JPEG, PNG, or WebP.');
      return false;
    }

    // Match the backend upload limit.
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setPhotoError(`File too large (${mb} MB): Maximum permitted image size is 5 MB.`);
      setDiagnosticToast(`File is ${mb} MB. Maximum allowed is 5 MB.`);
      return false;
    }

    // 3. Revoke any previous object URL to prevent memory leaks
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    // 4. Safely create object URL for actual selected photo
    try {
      const objectUrl = URL.createObjectURL(file);
      previewUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);
      setSelectedFile(file);
      setPhotoSelected(true);
      setPhotoError(null);

      setFileName(file.name.replace(/[^a-zA-Z0-9._-]/g, '_'));
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setFileSize(`${sizeMb} MB`);
      setDiagnosticToast(`Photo ready to attach: ${file.name} (${sizeMb} MB). The service must validate and sanitize uploaded evidence.`);
      return true;
    } catch {
      setPhotoError('File Reading Error: Failed to generate preview from local file.');
      setDiagnosticToast('File Error: Unable to read selected file into memory.');
      return false;
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndProcessPhoto(file);
    }
  };

  const handleClearPhoto = () => {
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setPhotoSelected(false);
    setFileName('No photo selected');
    setFileSize('');
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setDiagnosticToast('Photo removed. You can still submit the report without photo evidence.');
  };

  // Called when user clicks or drags pin on the interactive LocationPickerMap
  const handleMapLocationChange = useCallback(
    (newLat: number, newLng: number, estimatedWard?: string, suggestion?: string, acc?: number | null) => {
      setReportLat(newLat);
      setReportLng(newLng);
      if (acc !== undefined) {
        setGpsAccuracy(acc);
      } else {
        setGpsAccuracy(null);
      }
      if (estimatedWard) {
        setSelectedWard(estimatedWard);
      }
      if (suggestion) {
        setLandmark(suggestion);
      }
      setGpsStatus({
        type: 'manual',
        title: 'Marker Position Synchronized',
        message: `Pin updated to ${newLat.toFixed(5)}° N, ${newLng.toFixed(5)}° E. Form fields updated.`,
      });
    },
    []
  );

  // Real GPS Geolocation using getCurrentPosition()
  const handleUseCurrentLocation = () => {
    setShowLocationModal(false);

    if (typeof window !== 'undefined' && !('geolocation' in navigator)) {
      setGpsStatus({
        type: 'error',
        title: 'Geolocation Not Supported',
        message: 'Browser Geolocation API is not supported by your device. Please select your location manually on the interactive map.',
        code: 'ERR_GEOLOCATION_UNSUPPORTED',
      });
      setDiagnosticToast('Geolocation is not supported by this browser.');
      return;
    }

    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setGpsStatus({
        type: 'error',
        title: 'HTTPS Connection Required',
        message: 'Browser geolocation is restricted to secure (HTTPS) origins. Please use manual location selection on the map.',
        code: 'ERR_INSECURE_CONTEXT',
      });
      setDiagnosticToast('Geolocation blocked: HTTPS is required by browser security policies.');
      return;
    }

    setIsLocating(true);
    setLocationMode('detect');
    setGpsStatus({
      type: 'locating',
      title: 'Acquiring GPS Signal...',
      message: 'Requesting device satellite & network coordinates. Please grant location permission in your browser prompt.',
    });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setIsLocating(false);
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // Populate form and map state with actual detected coordinates
        setReportLat(userLat);
        setReportLng(userLng);
        setGpsAccuracy(accuracy);

        const accMeters = Math.round(accuracy);
        setGpsStatus({
          type: 'success',
          title: 'Current Location Detected',
          message: `GPS fix acquired with ±${accMeters}m accuracy. Coordinates updated in form. You can drag the pin on the map to adjust before submitting.`,
        });

        // Reverse geocoding to resolve street address
        setIsReverseGeocoding(true);
        try {
          const geoResult = await reverseGeocodeCoordinates(userLat, userLng);
          if (geoResult && geoResult.address) {
            setLandmark(geoResult.address);
            setDiagnosticToast(`GPS location: ${geoResult.address} (±${accMeters}m)`);
          } else {
            setDiagnosticToast(`GPS location: ${userLat.toFixed(4)}° N, ${userLng.toFixed(4)}° E (±${accMeters}m)`);
          }
        } catch {
          setDiagnosticToast(`GPS location: ${userLat.toFixed(4)}° N, ${userLng.toFixed(4)}° E (±${accMeters}m)`);
        } finally {
          setIsReverseGeocoding(false);
        }
      },
      (error) => {
        setIsLocating(false);
        const formatted = formatGeolocationError(error);
        setGpsStatus({
          type: 'error',
          title: formatted.title,
          message: formatted.message,
          code: formatted.code,
        });
        setDiagnosticToast(`Location note: ${formatted.title}. Please pinpoint location manually.`);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const handleCivicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionStartedRef.current || hasSubmitted) return;

    if (photoSelected && (!selectedFile || !previewUrl)) {
      setPhotoError('The selected photo could not be read. Please choose it again or remove it to continue without a photo.');
      setDiagnosticToast('Photo preview is unavailable. Re-select the photo or remove it before submitting.');
      return;
    }
    if (reportLat === null || reportLng === null || !Number.isFinite(reportLat) || !Number.isFinite(reportLng)) {
      setDiagnosticToast('Validation Error: A valid geographic location on the map is required.');
      return;
    }
    if (!landmark || landmark.trim().length < 3) {
      setDiagnosticToast('Validation Error: Please provide a specific landmark or street address for the location.');
      return;
    }
    if (!selectedWard.trim()) {
      setDiagnosticToast('Validation Error: Please enter the ward or area.');
      return;
    }
    if (!['low', 'moderate', 'severe'].includes(severity)) {
      setDiagnosticToast('Please select a severity.');
      return;
    }
    if (description.trim().length < 10) {
      setDiagnosticToast('Description must have at least 10 characters.');
      return;
    }
    if (!consentGiven) {
      setDiagnosticToast('Please confirm community ethics consent before submitting.');
      return;
    }

    submissionStartedRef.current = true;
    setIsSubmitting(true);
    setSubmissionStepText('Sending complaint to the secure service…');

    try {

      const categoryLabel = ({
        'overflowing-bin': 'Overflowing Municipal Bin',
        'open-roadside': 'Open Roadside Dumping',
        'drain-blockage': 'Drain / Nullah Blockage',
        'construction-debris': 'Construction Debris',
      } as Record<string, string>)[wasteCategory] || 'Plastic / Hazardous Waste';

      const created = await onAddReport(
        {
          id: '',
          title: `Report Summary: ${categoryLabel} at ${selectedWard}`,
          category: categoryLabel,
          ward: selectedWard,
          location: landmark,
          coordinates: `${reportLat.toFixed(5)}° N, ${reportLng.toFixed(5)}° E`,
          lat: reportLat ?? undefined,
          lng: reportLng ?? undefined,
          submittedAt: '',
          status: 'Submitted',
          triageTurnaround: '',
          resolutionSpan: '',
          geostampAccuracy: gpsAccuracy !== null ? `± ${Math.round(gpsAccuracy)}m` : '',
          attestations: '',
          originalImage: previewUrl || '',
          originalImageTag: selectedFile ? 'Evidence attached' : 'No evidence attached',
          siteAssessment: description,
          severity: severity as ReportItem['severity'],
          locationNotes,
          isUserSubmitted: true,
          hasLocalImage: Boolean(selectedFile),
          timeline: [],
        },
        selectedFile
      );
      setGeneratedRefId(created.id);
      setCreatedReport(created);
      setSubmissionStepText('Complaint received. Your reference was assigned by the secure service.');
      setHasSubmitted(true);
      setTimeout(() => postCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } catch (error) {
      setSubmissionStepText('');
      setDiagnosticToast(error instanceof Error ? error.message : 'Complaint could not be submitted. Please try again.');
      submissionStartedRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyRefId = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.');
      await navigator.clipboard.writeText(generatedRefId);
      setDiagnosticToast(`Reference ID copied: ${generatedRefId}`);
    } catch {
      setDiagnosticToast('Could not copy the reference. Select and copy it manually.');
    }
  };

  return (
    <main className="w-full pt-24 sm:pt-28 bg-surface">
      {diagnosticToast && <div aria-live="polite" className="mx-auto mb-4 flex max-w-5xl items-start justify-between gap-3 rounded-lg bg-surface-container-high px-4 py-3 text-sm text-on-surface" role="status"><span>{diagnosticToast}</span><button aria-label="Dismiss message" className="shrink-0 p-1 text-outline hover:text-on-surface" onClick={() => setDiagnosticToast(null)} type="button">×</button></div>}
      <div className="flex flex-col w-full">
        {/* Top Utility Context / Workflow Breadcrumb */}
        <div className="w-full px-3 sm:px-6 lg:px-8 py-2.5 bg-surface-container-low flex flex-wrap items-center justify-between text-label-md font-label-md text-on-surface-variant gap-2">
          {/* Breadcrumb selector: //main//a[@data-path='home' and text()='Home'] */}
          <div className="flex items-center gap-space-xs flex-wrap">
            <a
              className="hover:text-primary transition-colors cursor-pointer py-1 inline-flex items-center min-h-[36px]"
              data-path="home"
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('home', 'back');
              }}
            >
              Home
            </a>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-primary font-bold">Submit a Complaint</span>
            <span className="material-symbols-outlined text-sm hidden sm:inline">chevron_right</span>
            <span className="text-outline hidden sm:inline">Step 1 of 4: Civic Evidence Filing</span>
          </div>

          <div className="flex items-center gap-2 text-label-sm font-label-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-surface-tint"></span>
            <span className="uppercase tracking-wider font-semibold text-xs sm:text-label-sm">Account-scoped complaint</span>
            <span className="text-outline-variant">|</span>
            <span className="text-xs sm:text-label-sm">Sign-in required</span>
          </div>
        </div>

        {/* Main Grid Section */}
        <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-space-lg">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-gutter items-start">
            {/* Primary Column: Form Instructions & Core Submission (8 Cols) */}
            <div className="lg:col-span-8 flex flex-col gap-4 sm:gap-space-md w-full">
              {/* Header & Stated Purpose */}
              <div className="bg-surface-container-lowest p-4 sm:p-space-lg rounded-xl shadow-sm border border-outline-variant/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    add_photo_alternate
                  </span>
                  <span className="text-label-md font-label-md uppercase tracking-wider text-secondary font-bold text-xs sm:text-label-md">
                    Citizen complaint submission
                  </span>
                </div>
                <h1 className="font-headline-lg text-2xl sm:text-headline-lg text-on-surface mb-2 font-bold">
                  Submit a civic complaint
                </h1>
                <p className="font-body-lg text-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
                  Submit a civic cleanliness complaint. Your report is visible to you and to authorized staff with permission for its jurisdiction.
                </p>

                {/* Essential Warning Banner */}
                <div className="mt-3 sm:mt-space-md p-3 sm:p-space-md bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-lg flex items-start gap-2.5 sm:gap-space-sm shadow-sm">
                  <span className="material-symbols-outlined text-xl flex-shrink-0 mt-0.5">verified_user</span>
                  <div className="flex flex-col gap-1">
                    <span className="font-title-md text-title-md font-bold text-xs sm:text-title-md">
                      Private Evidence Notice
                    </span>
                    <p className="font-body-sm text-xs sm:text-body-sm leading-normal">
                      Complaint details and any attached photo are private. Upload only evidence needed to explain the issue. Do not include identifiable people, children, private interiors, or unrelated personal information. The configured backend must validate uploads, remove unnecessary metadata, and restrict photo access.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Canvas */}
              <form
                className="flex flex-col gap-4 sm:gap-space-md w-full"
                id="civic-report-form"
                noValidate
                onSubmit={handleCivicSubmit}
              >
                {/* SECTION 1: Photographic Evidence (Required) */}
                <div className="bg-surface-container-lowest p-4 sm:p-space-lg rounded-xl shadow-sm flex flex-col gap-3 sm:gap-space-md border border-outline-variant/30">
                  <div className="flex items-center justify-between pb-space-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-sm bg-primary text-on-primary text-label-md font-label-md flex items-center justify-center font-bold">
                        1
                      </span>
                      <h2 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">
                        Photographic Evidence <span className="font-normal text-on-surface-variant">(Optional)</span>
                      </h2>
                    </div>
                    <span className="font-label-sm text-label-sm px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-sm font-semibold text-xs">
                      Optional Evidence
                    </span>
                  </div>
                  <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant -mt-1 sm:-mt-2 leading-relaxed">
                    Add a photo if available; reports can be submitted without one. Accepted formats: JPEG, PNG, or WebP, up to 5 MB. The backend validates and stores uploaded evidence in private storage.
                  </p>

                  {/* Dropzone with Drag and Drop */}
                  <div
                    className={`relative group cursor-pointer bg-surface-container-low hover:bg-surface-container p-4 sm:p-space-lg rounded-lg transition-all text-center flex flex-col items-center justify-center min-h-[150px] sm:min-h-[170px] border border-dashed ${
                      isDragging ? 'border-primary bg-primary/10' : 'border-outline-variant/60'
                    }`}
                    id="dropzone-area"
                    onClick={() => fileInputRef.current?.click()}
                    onDragLeave={() => setIsDragging(false)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        validateAndProcessPhoto(file);
                      }
                    }}
                  >
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Upload a clear photograph of the waste accumulation"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                      id="photo-input"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      type="file"
                    />
                    <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary group-hover:scale-105 transition-transform mb-2">
                      <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                    </div>
                    <span className="font-title-md text-sm sm:text-title-md text-on-surface group-hover:text-primary transition-colors font-bold">
                      {photoSelected ? 'Photo selected — tap to change' : 'Add a photo (optional)'}
                    </span>
                    <span className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant mt-1">
                      Drag and drop your civic image here, or{' '}
                      <span className="text-primary font-semibold underline underline-offset-2">browse files</span>
                    </span>
                    <span className="font-label-sm text-label-sm text-outline mt-2 text-xs">
                      JPEG, PNG, or WebP · Maximum 5 MB
                    </span>

                  </div>

                  {/* Validation Error Alert */}
                  {photoError && (
                    <div
                      className="p-space-sm bg-error-container text-on-error-container rounded-lg text-body-sm font-body-sm flex items-center gap-2"
                      id="photo-error-message"
                    >
                      <span className="material-symbols-outlined text-base flex-shrink-0">error</span>
                      <span className="text-xs sm:text-body-sm">{photoError}</span>
                    </div>
                  )}

                  {/* Upload Preview Box */}
                  <div
                    className={`p-3 sm:p-space-md bg-surface-container-low rounded-lg flex flex-col sm:flex-row gap-3 sm:gap-space-md items-start sm:items-center justify-between border border-outline-variant/30 ${
                      !photoSelected ? 'opacity-60' : ''
                    }`}
                    id="upload-preview-box"
                  >
                    <div className="flex items-center gap-3 sm:gap-space-md w-full sm:w-auto">
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-surface-dim flex-shrink-0 shadow-inner flex items-center justify-center">
                        {photoSelected && previewUrl ? (
                          <>
                            <img
                              alt={fileName}
                              className="w-full h-full object-cover"
                              id="uploaded-image-preview"
                              src={previewUrl}
                            />
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-outline p-2 text-center">
                            <span className="material-symbols-outlined text-2xl text-outline-variant">add_a_photo</span>
                            <span className="text-[10px] mt-0.5 leading-tight">No Photo</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 sm:gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-title-md text-xs sm:text-title-md text-on-surface truncate font-bold"
                            id="preview-filename"
                          >
                            {fileName}
                          </span>
                          {fileSize && (
                            <span className="font-label-sm text-[10px] sm:text-label-sm px-1.5 py-0.5 bg-secondary-container text-on-secondary-container rounded-sm font-bold">
                              {fileSize}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-label-sm text-on-surface-variant">
                          <span className="flex items-center gap-1 text-secondary font-medium">
                            <span className="material-symbols-outlined text-xs">format_image_left</span>
                            Evidence: Selected
                          </span>
                          <span className="text-outline-variant">•</span>
                          <span className="flex items-center gap-1 text-on-surface-variant">
                            <span className="material-symbols-outlined text-xs">storage</span>
                            Local preview
                          </span>
                        </div>
                        <span className="text-[10px] sm:text-label-sm text-on-surface-variant italic truncate">
                          {photoSelected
                            ? 'Preview only. Uploaded only when you submit this complaint.'
                            : 'No photo selected. You can submit without evidence.'}
                        </span>
                      </div>
                    </div>

                    {/* Accessible Action buttons */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-1 sm:pt-0">
                      <button
                        className="flex-1 sm:flex-initial min-h-[44px] px-3 py-2 bg-surface text-on-surface hover:bg-surface-container font-title-md text-xs sm:text-title-md rounded-lg shadow-sm flex items-center justify-center gap-1 transition-colors cursor-pointer border border-outline-variant/30"
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-base">cached</span>
                        <span>Replace</span>
                      </button>
                      <button
                        aria-label="Remove image and reset upload zone"
                        className={`flex-1 sm:flex-initial min-h-[44px] px-3 py-2 font-title-md text-xs sm:text-title-md rounded-lg flex items-center justify-center gap-1 transition-colors ${
                          photoSelected
                            ? 'bg-error-container text-on-error-container hover:bg-opacity-80 cursor-pointer'
                            : 'bg-surface-container text-outline cursor-not-allowed'
                        }`}
                        disabled={!photoSelected}
                        onClick={handleClearPhoto}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Location Details (Required) */}
                <div className="bg-surface-container-lowest p-4 sm:p-space-lg rounded-xl shadow-sm flex flex-col gap-3 sm:gap-space-md border border-outline-variant/30">
                  <div className="flex items-center justify-between pb-space-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-sm bg-primary text-on-primary text-label-md font-label-md flex items-center justify-center font-bold">
                        2
                      </span>
                      <h2 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">
                        Agartala Location Details <span aria-hidden="true" className="text-error">*</span>
                      </h2>
                    </div>
                    <span className="font-label-sm text-label-sm text-secondary font-bold text-xs sm:text-label-sm">
                      Interactive Map Pin
                    </span>
                  </div>

                  {/* GPS Location Action & Modes */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                      {/* Clearly labelled button: "Use My Current Location" */}
                      <button
                        className="min-h-[44px] px-4 py-2.5 bg-primary text-on-primary hover:bg-primary-container font-title-md text-xs sm:text-title-md rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all font-bold disabled:opacity-60 active:scale-[0.98]"
                        id="use-current-location-btn"
                        onClick={handleUseCurrentLocation}
                        disabled={isLocating}
                        type="button"
                        aria-label="Use My Current Location via browser GPS"
                      >
                        {isLocating ? (
                          <>
                            <span className="inline-block w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
                            <span>Acquiring GPS Signal...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-base">my_location</span>
                            <span>Use My Current Location</span>
                          </>
                        )}
                      </button>

                      {/* Manual / Modal Choice toggle */}
                      <div className="p-1 bg-surface-container rounded-lg flex items-center gap-1 text-label-md font-label-md">
                        <button
                          className={`min-h-[36px] py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs ${
                            locationMode === 'manual'
                              ? 'bg-surface text-primary font-bold shadow-sm'
                              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/50'
                          }`}
                          id="toggle-manual-btn"
                          onClick={() => setLocationMode('manual')}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-sm">pin_drop</span>
                          <span>Manual Pin</span>
                        </button>
                        <button
                          className={`min-h-[36px] py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs ${
                            locationMode === 'detect'
                              ? 'bg-surface text-primary font-bold shadow-sm'
                              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/50'
                          }`}
                          id="toggle-detect-btn"
                          onClick={() => setShowLocationModal(true)}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-sm">help_outline</span>
                          <span>Privacy Guide</span>
                        </button>
                      </div>
                    </div>

                    {/* Permission and Purpose Explanatory Strip */}
                    <div className="p-2.5 bg-surface-container-low rounded-lg text-xs font-body-sm text-on-surface-variant flex items-start gap-2 border border-outline-variant/20">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5 flex-shrink-0">info</span>
                      <p>
                        <strong>Why location is needed:</strong> Location helps identify the complaint area. Browser location is requested only after you tap the location button; you can decline and place the map pin manually.
                      </p>
                    </div>

                    {/* GPS Status & Accuracy Feedback Alert */}
                    {gpsStatus.type !== 'idle' && (
                      <div
                        className={`p-3 rounded-lg text-xs sm:text-body-sm font-body-sm flex flex-col gap-1 border ${
                          gpsStatus.type === 'success'
                            ? 'bg-secondary-container/40 text-on-surface border-secondary/30'
                            : gpsStatus.type === 'error'
                            ? 'bg-error-container/40 text-on-error-container border-error/30'
                            : gpsStatus.type === 'locating'
                            ? 'bg-surface-container-high text-on-surface border-primary/30 animate-pulse'
                            : 'bg-surface-container-low text-on-surface border-outline-variant/30'
                        }`}
                        role="status"
                        aria-live="polite"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="material-symbols-outlined text-base">
                              {gpsStatus.type === 'success'
                                ? 'check_circle'
                                : gpsStatus.type === 'error'
                                ? 'warning'
                                : gpsStatus.type === 'locating'
                                ? 'radar'
                                : 'place'}
                            </span>
                            <span>{gpsStatus.title}</span>
                          </div>
                          {gpsAccuracy !== null && gpsAccuracy !== undefined && (
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface text-on-surface font-semibold border border-outline-variant/30 shadow-xs">
                              ±{Math.round(gpsAccuracy)}m GPS Accuracy
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-body-sm opacity-90 leading-relaxed">{gpsStatus.message}</p>
                        {gpsAccuracy !== null && (
                          <span className="text-[11px] text-outline font-label-sm mt-0.5">
                            * Accuracy depends on device hardware, cellular networks, and satellite line-of-sight.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* REAL INTERACTIVE LOCATION PICKER MAP COMPONENT */}
                  <LocationPickerMap
                    lat={reportLat ?? 23.833}
                    lng={reportLng ?? 91.284}
                    selectedWard={selectedWard}
                    accuracy={gpsAccuracy}
                    isLocating={isLocating}
                    onLocationChange={handleMapLocationChange}
                    onRequestGeolocation={handleUseCurrentLocation}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-space-md">
                    {/* User-entered ward or area */}
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="font-title-md text-xs sm:text-title-md text-on-surface flex items-center justify-between" htmlFor="ward-select">
                        <span>
                          Ward or area <span className="text-error">*</span>
                        </span>
                      </label>
                      <input className="w-full bg-surface-container-lowest text-on-surface h-[44px] px-3 rounded-lg shadow-sm font-body-md text-sm sm:text-body-md focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/40" id="ward-select" required maxLength={100} placeholder="Enter the ward or area if known" value={selectedWard} onChange={(event) => setSelectedWard(event.target.value)} />
                      <span className="font-body-sm text-xs text-on-surface-variant">
                        Enter the ward or area as you know it. Unconfigured areas are left unassigned for authority routing.
                      </span>
                    </div>

                    {/* Synchronized Latitude & Longitude Coordinates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:col-span-2 p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
                      <div className="flex flex-col gap-1">
                        <label className="font-title-md text-xs sm:text-title-md text-on-surface flex items-center justify-between" htmlFor="latitude-field">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-primary">explore</span>
                            <span>Selected Latitude (°N)</span>
                          </span>
                          <span className="font-mono text-[11px] text-secondary font-semibold">Synchronized with Pin</span>
                        </label>
                        <input
                          id="latitude-field"
                          type="number"
                          step="0.00001"
                          required
                          value={reportLat ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setReportLat(e.target.value === '' || Number.isNaN(val) ? null : val);
                          }}
                          className="w-full bg-surface-container-lowest text-on-surface h-[44px] px-3 rounded-lg shadow-sm font-mono text-sm sm:text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface border border-outline-variant/40"
                          placeholder="23.83150"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="font-title-md text-xs sm:text-title-md text-on-surface flex items-center justify-between" htmlFor="longitude-field">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-primary">explore</span>
                            <span>Selected Longitude (°E)</span>
                          </span>
                          <span className="font-mono text-[11px] text-secondary font-semibold">5 Decimals</span>
                        </label>
                        <input
                          id="longitude-field"
                          type="number"
                          step="0.00001"
                          required
                          value={reportLng ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setReportLng(e.target.value === '' || Number.isNaN(val) ? null : val);
                          }}
                          className="w-full bg-surface-container-lowest text-on-surface h-[44px] px-3 rounded-lg shadow-sm font-mono text-sm sm:text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface border border-outline-variant/40"
                          placeholder="91.28680"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-between text-xs text-on-surface-variant flex-wrap gap-2 pt-1 border-t border-outline-variant/20">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-outline">sync</span>
                          Coordinates auto-update when dragging pin on map or tapping "Use My Current Location".
                        </span>
                        {gpsAccuracy !== null && (
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface text-secondary font-bold border border-outline-variant/20">
                            Current Accuracy: ±{Math.round(gpsAccuracy)}m
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Landmark input */}
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="font-title-md text-xs sm:text-title-md text-on-surface" htmlFor="landmark-input">
                        Specific Landmark / Street Address <span className="text-error">*</span>
                      </label>
                      <input
                        className="w-full bg-surface-container-lowest text-on-surface h-[44px] px-3 rounded-lg shadow-sm font-body-md text-sm sm:text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface border border-outline-variant/40"
                        id="landmark-input"
                        placeholder="Street name or nearby landmark"
                        required
                        type="text"
                        value={landmark}
                        onChange={(e) => setLandmark(e.target.value)}
                      />
                      <span className="font-body-sm text-xs text-on-surface-variant">
                        Provide clear orientation points accessible by foot or municipal cart.
                      </span>
                    </div>

                    {/* Location Notes */}
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="font-title-md text-xs sm:text-title-md text-on-surface flex items-center justify-between" htmlFor="location-notes">
                        <span>
                          Location Notes <span className="font-label-sm text-xs text-outline font-normal">(Optional)</span>
                        </span>
                        <span className="font-label-sm text-xs text-outline">Obstruction cues</span>
                      </label>
                      <input
                        className="w-full bg-surface-container-lowest text-on-surface h-[44px] px-3 rounded-lg shadow-sm font-body-md text-sm sm:text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface border border-outline-variant/40"
                        id="location-notes"
                        placeholder="Additional directions that help identify the place"
                        type="text"
                        maxLength={500}
                        value={locationNotes}
                        onChange={(e) => setLocationNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Waste Categorisation & Severity (Required) */}
                <div className="bg-surface-container-lowest p-4 sm:p-space-lg rounded-xl shadow-sm flex flex-col gap-3 sm:gap-space-md border border-outline-variant/30">
                  <div className="flex items-center justify-between pb-space-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-sm bg-primary text-on-primary text-label-md font-label-md flex items-center justify-center font-bold">
                        3
                      </span>
                      <h2 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">
                        Waste Categorisation &amp; Severity <span aria-hidden="true" className="text-error">*</span>
                      </h2>
                    </div>
                    <span className="font-label-sm text-label-sm text-secondary font-bold text-xs sm:text-label-sm">
                      Complaint details
                    </span>
                  </div>

                  {/* Primary Waste Type Radios */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-title-md text-xs sm:text-title-md text-on-surface font-semibold">
                      Primary Waste Type
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        {
                          val: 'overflowing-bin',
                          title: 'Overflowing Municipal Bin',
                          sub: 'Spillover onto public sidewalk',
                        },
                        {
                          val: 'open-roadside',
                          title: 'Open Roadside Dumping',
                          sub: 'Unauthorized street waste pile',
                        },
                        {
                          val: 'drain-blockage',
                          title: 'Drain / Nullah Blockage',
                          sub: 'Stagnant water or choked culvert',
                        },
                        {
                          val: 'construction-debris',
                          title: 'Construction Debris',
                          sub: 'Concrete, masonry & sand blocks',
                        },
                        {
                          val: 'hazardous-waste',
                          title: 'Plastic / Hazardous Waste',
                          sub: 'Single-use microplastics, discarded electronics, or chemical runoff',
                          wide: true,
                        },
                      ].map((cat) => (
                        <label
                          key={cat.val}
                          className={`p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container cursor-pointer flex items-start gap-2 shadow-sm transition-all border border-outline-variant/20 min-h-[44px] ${
                            cat.wide ? 'sm:col-span-2 md:col-span-2' : ''
                          } ${wasteCategory === cat.val ? 'bg-secondary-container/40 ring-1 ring-primary' : ''}`}
                        >
                          <input
                            checked={wasteCategory === cat.val}
                            className="w-4 h-4 mt-0.5 accent-primary text-primary flex-shrink-0"
                            name="waste-category"
                            type="radio"
                            value={cat.val}
                            onChange={() => setWasteCategory(cat.val)}
                          />
                          <div className="flex flex-col">
                            <span className="font-title-md text-xs sm:text-title-md text-on-surface font-semibold leading-snug">
                              {cat.title}
                            </span>
                            <span className="font-body-sm text-[11px] sm:text-body-sm text-on-surface-variant leading-tight mt-0.5">
                              {cat.sub}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Severity Level */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-title-md text-xs sm:text-title-md text-on-surface flex items-center justify-between">
                      <span>Severity Level</span>
                      <span className="font-label-sm text-xs text-outline">Choose one</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 'low', label: 'Low', sub: '', activeCls: 'bg-secondary-container ring-1 ring-primary' },
                        { val: 'moderate', label: 'Moderate', sub: '', activeCls: 'bg-secondary-container ring-1 ring-tertiary' },
                        { val: 'severe', label: 'Severe', sub: '', activeCls: 'bg-error-container ring-1 ring-error' },
                      ].map((s) => (
                        <label
                          key={s.val}
                          className={`p-2 sm:p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container cursor-pointer flex flex-col items-center justify-center text-center shadow-sm border border-outline-variant/20 transition-all min-h-[52px] ${
                            severity === s.val ? s.activeCls : ''
                          }`}
                        >
                          <input
                            checked={severity === s.val}
                            className="sr-only"
                            name="severity-level"
                            type="radio"
                            value={s.val}
                            onChange={() => setSeverity(s.val)}
                          />
                          <span className={`font-title-md text-xs sm:text-title-md text-on-surface ${severity === s.val ? 'font-bold' : ''}`}>
                            {s.label}
                          </span>
                          <span className="font-label-sm text-[10px] sm:text-label-sm text-on-surface-variant mt-0.5 truncate max-w-full">
                            {s.sub}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Description Field */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="font-title-md text-xs sm:text-title-md text-on-surface font-semibold" htmlFor="issue-description">
                        Describe the issue and obstruction <span className="text-error">*</span>
                      </label>
                      <span
                        className={`font-label-sm text-xs ${
                          description.length < 10 ? 'text-error' : 'text-secondary font-medium'
                        }`}
                        id="char-counter"
                      >
                        {description.length < 10
                          ? `${10 - description.length} more character${10 - description.length === 1 ? '' : 's'} required`
                          : `${description.length} characters (Sufficient)`}
                      </span>
                    </div>
                    <textarea
                      className="w-full bg-surface-container-lowest text-on-surface p-3 rounded-lg shadow-sm font-body-md text-sm sm:text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface leading-relaxed border border-outline-variant/40"
                      id="issue-description"
                      minLength={10}
                      placeholder="State visible volume, duration if known, and whether pedestrian movement or drainage channels are obstructed..."
                      required
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    <span className="font-body-sm text-xs text-on-surface-variant">
                      Describe only what you observed. Submission does not guarantee review or a response.
                    </span>
                  </div>
                </div>

                {/* SECTION 4: Privacy & Optional Contact */}
                <div className="bg-surface-container-lowest p-4 sm:p-space-lg rounded-xl shadow-sm flex flex-col gap-3 sm:gap-space-md border border-outline-variant/30">
                  <div className="flex items-center justify-between pb-space-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-sm bg-primary text-on-primary text-label-md font-label-md flex items-center justify-center font-bold">
                        4
                      </span>
                      <h2 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">
                        Privacy &amp; Notification <span aria-hidden="true" className="text-error">*</span>
                      </h2>
                    </div>
                    <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container text-on-surface font-semibold rounded-sm text-xs">
                      Service information
                    </span>
                  </div>

                  <div className="p-3 sm:p-space-md bg-surface-container-low rounded-lg flex items-start gap-2.5 sm:gap-space-sm shadow-sm border border-outline-variant/20">
                    <span className="material-symbols-outlined text-primary text-xl sm:text-2xl flex-shrink-0 mt-0.5">
                      fingerprint_off
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-title-md text-xs sm:text-title-md text-on-surface font-bold">
                        Account Required to Submit
                      </span>
                      <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant leading-relaxed">
                        Sign in is required. The backend associates the complaint with your signed-in account.
                      </p>
                    </div>
                  </div>

                  {/* Mandatory Consent Checkbox */}
                  <div className="p-3 sm:p-space-md bg-surface-container rounded-lg flex items-start gap-2.5 sm:gap-space-sm shadow-sm border border-outline-variant/30">
                    <input
                      checked={consentGiven}
                      className="w-5 h-5 mt-0.5 accent-primary rounded-sm cursor-pointer flex-shrink-0"
                      id="consent-checkbox"
                      required
                      type="checkbox"
                      onChange={(e) => setConsentGiven(e.target.checked)}
                    />
                    <label className="font-body-sm text-xs sm:text-body-sm text-on-surface leading-normal cursor-pointer" htmlFor="consent-checkbox">
                      I understand that this complaint and any attached photo will be sent to the configured service. I will avoid including unnecessary personal information. Read the{' '}
                      <a
                        className="text-primary font-bold underline underline-offset-2 cursor-pointer"
                        data-path="terms-and-conditions"
                        href="#terms-and-conditions"
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenInfoModal(
                            'CleanMap Prototype Terms',
                            'CleanMap is an independent prototype and does not file official municipal complaints. It has not been certified as legally compliant. Do not submit information you do not want processed by the configured service.'
                          );
                        }}
                      >
                        prototype status
                      </a>{' '}
                      and acknowledge this is an independent civic tool unaffiliated with municipal administration.
                    </label>
                  </div>
                </div>

                {/* SECTION 5: Form Submission Actions & Live States */}
                <div className="bg-surface-container-lowest p-4 sm:p-space-lg rounded-xl shadow-sm flex flex-col gap-3 sm:gap-space-md border border-outline-variant/30">
                  {/* Progress Indicator */}
                  {isSubmitting && (
                    <div className="flex flex-col gap-2 p-3 sm:p-space-md bg-surface-container-low rounded-lg shadow-sm border border-outline-variant/30" id="submission-stepper">
                      <div className="flex items-center justify-between text-xs sm:text-label-md font-label-md">
                        <span className="text-primary font-bold flex items-center gap-1.5" id="step-label">
                          <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                          {submissionStepText}
                        </span>
                        <span className="font-mono text-outline text-xs sm:text-label-sm" id="step-percent">In progress</span>
                      </div>
                      <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full w-1/3 animate-pulse"
                          id="progress-bar-inner"
                        />
                      </div>
                      <span className="text-xs text-on-surface-variant italic">
                        Sending your complaint to the configured service…
                      </span>
                    </div>
                  )}

                  {/* Action Buttons Grid: Stack vertically on mobile, row on tablet/desktop */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-space-xs">
                    {/* Selector: //a[@data-path='home' and contains(text(), 'Cancel and Return to Home')] */}
                    <a
                      className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-surface-container text-on-surface hover:bg-surface-container-high font-title-md text-sm sm:text-title-md rounded-lg text-center transition-colors cursor-pointer border border-outline-variant/30 flex items-center justify-center"
                      data-path="home"
                      href="#home"
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate('home', 'back');
                      }}
                    >
                      Cancel and Return to Home
                    </a>

                    <button
                      className={`w-full sm:w-auto min-h-[48px] px-8 py-3 bg-primary text-on-primary hover:bg-primary-container font-title-md text-sm sm:text-title-md rounded-lg shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isSubmitting || hasSubmitted ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={isSubmitting || hasSubmitted}
                      id="submit-btn"
                      type="submit"
                    >
                      <span className="material-symbols-outlined text-xl">send</span>
                      <span>Submit Cleanliness Report</span>
                    </button>
                  </div>
                </div>

                {/* SUCCESS STATE CARD: post-submission-card */}
                {/* Selector: //div[@id='post-submission-card']//a[@data-path='track-a-report'] */}
                <div
                  ref={postCardRef}
                  className={`bg-surface-container-lowest p-4 sm:p-space-lg rounded-xl shadow-md flex flex-col gap-3 sm:gap-space-md border border-outline-variant/40 transition-all duration-300 ${
                    hasSubmitted ? 'ring-2 ring-primary block' : 'hidden'
                  }`}
                  id="post-submission-card"
                >
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-2xl font-bold">check_circle</span>
                      </div>
                      <div>
                        <span className="font-label-sm text-xs uppercase tracking-wider text-secondary font-bold">
                          Complaint submission
                        </span>
                        <h3 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">
                          Complaint received
                        </h3>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-surface-container text-primary font-mono font-bold text-xs rounded-sm">
                      STATUS: {createdReport?.status || 'SUBMITTED'}
                    </span>
                  </div>

                  {/* Prominent Reference ID Display */}
                  <div className="p-3 sm:p-space-md bg-surface-container-low rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border border-outline-variant/20">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">
                        Complaint reference
                      </span>
                      <span className="font-headline-md text-xl sm:text-headline-md text-primary font-mono font-bold tracking-tight">
                        {generatedRefId}
                      </span>
                      <span className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
                        Keep this reference to find your complaint when you are signed in.
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 sm:pt-0">
                      <button
                        className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 bg-surface text-on-surface hover:bg-surface-container font-title-md text-xs sm:text-title-md rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-outline-variant/30"
                        onClick={copyRefId}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-base">content_copy</span>
                        <span>Copy ID</span>
                      </button>

                      {/* Selector: //div[@id='post-submission-card']//a[@data-path='track-a-report'] */}
                      <a
                        className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 bg-primary text-on-primary hover:bg-primary-container font-title-md text-xs sm:text-title-md rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                        data-path="track-a-report"
                        href="#track-a-report"
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate('track-a-report', 'forward', generatedRefId);
                        }}
                      >
                        <span>Track Status</span>
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-label-sm pt-2">
                    <div className="p-2 bg-surface rounded-md border border-outline-variant/20">
                      <span className="text-outline block">Ward:</span>
                      <span className="font-semibold text-on-surface truncate block">{selectedWard}</span>
                    </div>
                    <div className="p-2 bg-surface rounded-md border border-outline-variant/20">
                      <span className="text-outline block">Category:</span>
                      <span className="font-semibold text-on-surface truncate block">
                        {wasteCategory === 'overflowing-bin'
                          ? 'Overflowing Bin'
                          : wasteCategory === 'open-roadside'
                          ? 'Roadside Dumping'
                          : wasteCategory === 'drain-blockage'
                          ? 'Drain Blockage'
                          : wasteCategory === 'construction-debris'
                          ? 'Debris'
                          : 'Hazardous'}
                      </span>
                    </div>
                    <div className="p-2 bg-surface rounded-md border border-outline-variant/20">
                      <span className="text-outline block">Evidence:</span>
                      <span className="font-semibold text-on-surface truncate block">Service managed</span>
                    </div>
                    <div className="p-2 bg-surface rounded-md border border-outline-variant/20">
                      <span className="text-outline block">Storage:</span>
                      <span className="font-semibold text-on-surface truncate block">Protected service</span>
                    </div>
                  </div>

                  {/* Browser-Local Storage & Privacy Limitation Notice */}
                  <div className="p-3 bg-secondary-container/40 text-on-secondary-container rounded-lg text-xs flex items-start gap-2 border border-secondary/20 leading-relaxed">
                    <span className="material-symbols-outlined text-base flex-shrink-0 text-secondary mt-0.5">lock</span>
                    <div>
                      <strong>Service confirmation:</strong> The reference and status are returned by the configured complaint service. Backend ownership checks and role permissions protect the complaint and any evidence.
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Guidance and service requirements */}
            <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-space-md w-full">
              {/* Dossier Quality Standards */}
              <div className="bg-surface-container-lowest p-4 sm:p-space-lg rounded-xl shadow-sm flex flex-col gap-3 sm:gap-space-md border border-outline-variant/30">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">fact_check</span>
                  <h3 className="font-title-lg text-base sm:text-title-lg text-on-surface font-bold">Dossier Quality Standards</h3>
                </div>
                <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
                  Before submitting, check that your complaint is clear, necessary, and about a public civic issue:
                </p>

                <div className="space-y-2 sm:space-y-space-sm font-body-sm text-xs sm:text-body-sm">
                  <div className="p-2.5 sm:p-space-sm bg-surface-container-low rounded-lg flex items-start gap-2 border border-outline-variant/20">
                    <span className="material-symbols-outlined text-secondary text-base mt-0.5 flex-shrink-0">check</span>
                    <div>
                      <strong className="text-on-surface">Visible Waste Boundary:</strong>
                      <p className="text-on-surface-variant">The accumulation must be clearly photographed in good lighting against recognized Agartala public rights-of-way.</p>
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-space-sm bg-surface-container-low rounded-lg flex items-start gap-2 border border-outline-variant/20">
                    <span className="material-symbols-outlined text-error text-base mt-0.5 flex-shrink-0">block</span>
                    <div>
                      <strong className="text-on-surface">No PII or Face Imagery:</strong>
                      <p className="text-on-surface-variant">Avoid including identifiable people or unrelated personal information. This prototype does not claim automatic face or privacy filtering.</p>
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-space-sm bg-surface-container-low rounded-lg flex items-start gap-2 border border-outline-variant/20">
                    <span className="material-symbols-outlined text-secondary text-base mt-0.5 flex-shrink-0">check</span>
                    <div>
                      <strong className="text-on-surface">Exact Landmark Reference:</strong>
                      <p className="text-on-surface-variant">Agartala roads frequently have identical market names. Include nearby landmarks (e.g. Chowmuhani post office, transformer, bridge).</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-3 text-xs leading-5 text-on-surface-variant">
                  Status transitions and response times are controlled by the authorized service. This prototype makes no service-level commitment.
                </div>
              </div>

              {/* Privacy and backend requirements */}
              <div className="bg-surface-container-lowest p-4 sm:p-space-lg rounded-xl shadow-sm flex flex-col gap-3 sm:gap-space-md border border-outline-variant/30">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-xl">gavel</span>
                  <h3 className="font-title-lg text-base sm:text-title-lg text-on-surface font-bold">Privacy and service setup</h3>
                </div>
                <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
                  This prototype has not been legally reviewed or certified. The service operator must configure and verify privacy safeguards before accepting real complaints:
                </p>
                <ul className="space-y-2 text-xs sm:text-label-sm font-label-sm text-on-surface-variant">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-base flex-shrink-0">lock_clock</span>
                    <span><strong>Retention:</strong> Set and document a suitable retention and deletion policy.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-base flex-shrink-0">visibility_off</span>
                    <span><strong>Access:</strong> Enforce ownership and staff jurisdiction on the server and database.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-base flex-shrink-0">no_accounts</span>
                    <span><strong>Evidence:</strong> Validate uploads and store them in protected storage.</span>
                  </li>
                </ul>
                <div className="pt-space-xs">
                  <a
                    className="text-xs sm:text-label-md font-label-md text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer min-h-[44px]"
                    data-path="privacy-policy"
                    href="#privacy-policy"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenInfoModal(
                        'Privacy and service setup',
                        'CleanMap is a prototype and has not been certified as legally compliant. The service operator must review applicable law and configure data access, retention, deletion, security, and rights workflows before accepting real complaints.'
                      );
                    }}
                  >
                    <span>Privacy and service setup status</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </a>
                </div>
              </div>

              {/* Disclaimer Callout */}
              <div className="p-3 sm:p-space-md bg-surface-container-low text-on-surface-variant rounded-xl text-xs sm:text-label-sm font-label-sm leading-normal flex items-start gap-2 shadow-sm border border-outline-variant/20">
                <span className="material-symbols-outlined text-base text-outline mt-0.5 flex-shrink-0">flag</span>
                <div>
                      <strong>Independent prototype:</strong> Submissions here are not official municipal complaints. This service is not an emergency channel; use an appropriate official emergency service when immediate help is needed.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BROWSER LOCATION PERMISSION MODAL */}
        {showLocationModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/45 p-3 sm:p-space-md"
            id="location-permission-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-lg bg-surface rounded-xl shadow-xl p-4 sm:p-space-lg flex flex-col gap-3 sm:gap-space-md border border-outline-variant/30">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-space-sm">
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl">location_searching</span>
                  </div>
                  <div>
                    <span className="font-label-sm text-xs uppercase tracking-wider text-secondary font-bold">
                      Privacy-Preserving Geolocation
                    </span>
                    <h3 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">
                      Browser Location Request
                    </h3>
                  </div>
                </div>
                <button
                  aria-label="Close modal"
                  className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1"
                  onClick={() => setShowLocationModal(false)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              <div className="p-3 sm:p-space-md bg-surface-container-low rounded-lg text-xs sm:text-body-sm font-body-sm text-on-surface-variant leading-relaxed">
                <strong>Browser location is requested only after you choose to use it.</strong> Coordinates help place the complaint and may be sent to OpenStreetMap Nominatim for address lookup. Avoid reporting a private residence; the service operator must apply access and retention safeguards.
              </div>

              <div className="space-y-1.5 text-xs sm:text-label-sm font-label-sm text-outline">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-base flex-shrink-0">check_circle</span>
                  <span>Location is used for this complaint only</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-base flex-shrink-0">check_circle</span>
                  <span>No historical movement tracking or cookie storage</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-space-sm pt-space-xs">
                <button
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-surface text-on-surface hover:bg-surface-container font-title-md text-xs sm:text-title-md rounded-lg transition-colors cursor-pointer border border-outline-variant/30"
                  onClick={() => setShowLocationModal(false)}
                  type="button"
                >
                  Deny / Keep Manual Entry
                </button>
                <button
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2 bg-primary text-on-primary hover:bg-primary-container font-title-md text-xs sm:text-title-md rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer font-bold"
                  onClick={handleUseCurrentLocation}
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">my_location</span>
                  <span>Use My Current Location</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
};
