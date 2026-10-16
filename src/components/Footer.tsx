import React from 'react';
import { Screen, SelectedLocation } from '../types';

interface FooterProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen, direction?: 'forward' | 'back', reportId?: string, location?: SelectedLocation) => void;
  onOpenInfoModal: (title: string, content: string) => void;
}

export const Footer: React.FC<FooterProps> = ({
  currentScreen,
  onNavigate,
  onOpenInfoModal,
}) => {
  return (
    <footer className="w-full bg-surface-container-low mt-8 sm:mt-space-xl border-t border-outline-variant/30">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-space-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-gutter mb-8 sm:mb-space-xl">
          {/* Col 1: About Platform */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2 sm:mb-space-sm">
              <span className="font-headline-sm text-lg sm:text-headline-sm text-primary font-bold tracking-tight">
                CleanMap Tripura
              </span>
            </div>
            <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant mb-3 sm:mb-space-md leading-relaxed">
              An independent prototype for submitting and tracking civic cleanliness complaints in Tripura.
            </p>
            <div className="p-2.5 sm:p-space-sm bg-surface-container rounded-lg text-xs sm:text-label-sm font-label-sm text-on-surface-variant leading-normal border border-outline-variant/20">
              <strong>Notice:</strong> Strictly unaffiliated with Agartala Municipal Corporation (AMC). No municipal cleanup guarantee or official dispatch implied.
            </div>
          </div>

          {/* Col 2: Core Navigation */}
          <div>
            <h4 className="font-title-md text-sm sm:text-title-md text-on-surface mb-2 sm:mb-space-md uppercase tracking-wider font-bold">
              Core Navigation
            </h4>
            <ul className="space-y-1 sm:space-y-space-sm font-body-sm text-xs sm:text-body-sm">
              <li data-active-classes="text-primary font-bold">
                <a
                  className={`hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center ${
                    currentScreen === 'home' ? 'text-primary font-bold' : 'text-on-surface-variant'
                  }`}
                  data-path="home"
                  href="#home"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('home', 'back');
                  }}
                >
                  Home
                </a>
              </li>
              <li data-active-classes="text-primary font-bold">
                <a
                  className={`hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center ${
                    currentScreen === 'report-a-problem' ? 'text-primary font-bold' : 'text-on-surface-variant'
                  }`}
                  data-path="report-a-problem"
                  href="#report-a-problem"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('report-a-problem', 'forward');
                  }}
                >
                  Report a Problem
                </a>
              </li>
              <li data-active-classes="text-primary font-bold">
                <a
                  className={`hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center ${
                    currentScreen === 'track-a-report' ? 'text-primary font-bold' : 'text-on-surface-variant'
                  }`}
                  data-path="track-a-report"
                  href="#track-a-report"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('track-a-report', 'forward');
                  }}
                >
                  Track a Report
                </a>
              </li>
              <li><a className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center" href="/citizen/login" onClick={(event) => { event.preventDefault(); onNavigate('citizen-login'); }}>Citizen Login / Portal</a></li>
              <li><a className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center" href="/authority/login" onClick={(event) => { event.preventDefault(); onNavigate('authority-login'); }}>Authority Login / Portal</a></li>
              <li data-active-classes="text-primary font-bold">
                <a
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center"
                  data-path="authority-login"
                  href="/authority/login"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('authority-login');
                  }}
                >
                  Authority Portal
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Legal & Governance */}
          <div>
            <h4 className="font-title-md text-sm sm:text-title-md text-on-surface mb-2 sm:mb-space-md uppercase tracking-wider font-bold">
              Legal &amp; Governance
            </h4>
            <ul className="space-y-1 sm:space-y-space-sm font-body-sm text-xs sm:text-body-sm">
              <li data-active-classes="text-primary font-bold">
                <a
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center"
                  data-path="privacy-policy"
                  href="#privacy-policy"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenInfoModal(
                      'Privacy and Data Use',
                      'CleanMap is a prototype and has not received legal compliance certification. Before collecting real personal information or complaint evidence, the service owner must publish and implement an appropriate privacy notice, retention policy, and data rights process.'
                    );
                  }}
                >
                  Privacy status
                </a>
              </li>
              <li data-active-classes="text-primary font-bold">
                <a
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center"
                  data-path="cookie-policy"
                  href="#cookie-policy"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenInfoModal(
                      'Cookie Policy',
                      'Sign-in uses an HTTP-only session cookie issued by the backend. A complete privacy notice and retention policy have not yet been published.'
                    );
                  }}
                >
                  Session cookie information
                </a>
              </li>
              <li data-active-classes="text-primary font-bold">
                <a
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center"
                  data-path="terms-and-conditions"
                  href="#terms-and-conditions"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenInfoModal(
                      'Prototype Terms & Conditions',
                      'CleanMap is an independent prototype and does not file official municipal complaints. It has not been legally reviewed or certified.'
                    );
                  }}
                >
                  Prototype status
                </a>
              </li>
              <li data-active-classes="text-primary font-bold">
                <a
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center"
                  data-path="about"
                  href="#about"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenInfoModal(
                      'About CleanMap Tripura',
                      'An independent community prototype for submitting and following civic cleanliness complaints in Agartala.'
                    );
                  }}
                >
                  About CleanMap
                </a>
              </li>
              <li data-active-classes="text-primary font-bold">
                <a
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center"
                  data-path="prototype-limitations"
                  href="#prototype-limitations"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenInfoModal(
                      'Prototype Limitations & Disclaimers',
                      'CleanMap is not an official municipal dispatch system and makes no claim of government affiliation or response time.'
                    );
                  }}
                >
                  Prototype Limitations &amp; Disclaimers
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Civic & Safety Oversight */}
          <div>
            <h4 className="font-title-md text-sm sm:text-title-md text-on-surface mb-2 sm:mb-space-md uppercase tracking-wider font-bold">
              Civic &amp; Safety Oversight
            </h4>
            <ul className="space-y-1 sm:space-y-space-sm font-body-sm text-xs sm:text-body-sm">
              <li data-active-classes="text-primary font-bold">
                <a
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center"
                  data-path="contact-and-feedback"
                  href="#contact-and-feedback"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenInfoModal(
                      'Contact and Feedback',
                      'No feedback service is configured in this prototype. Contact the project owner through the channel where you received this application.'
                    );
                  }}
                >
                  Contact and Feedback
                </a>
              </li>
              <li data-active-classes="text-primary font-bold">
                <a
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center"
                  data-path="report-website-problem"
                  href="#report-website-problem"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenInfoModal(
                      'Report a Problem with the Website',
                      'No website support channel is configured in this prototype. Contact the project owner through the channel where you received this application.'
                    );
                  }}
                >
                  Report a Problem with the Website
                </a>
              </li>
              <li data-active-classes="text-primary font-bold">
                <a
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center"
                  data-path="report-abuse"
                  href="#report-abuse"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenInfoModal(
                      'Report Abuse or Flag Content',
                      'A content removal and privacy incident process must be configured by the service owner before real complaints or photos are accepted.'
                    );
                  }}
                >
                  Report Abuse or Flag Content
                </a>
              </li>
              <li data-active-classes="text-primary font-bold">
                <a
                  className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px] flex items-center"
                  data-path="launch-risk-checklist"
                  href="#launch-risk-checklist"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenInfoModal(
                      'Launch Risk & Legal Checklist',
                      'Review the Digital Personal Data Protection Act, 2023, applicable rules, and commencement notifications with qualified counsel before launch. This prototype is not certified as legally compliant.'
                    );
                  }}
                >
                  Launch Risk &amp; Legal Checklist
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Attribution */}
        <div className="pt-4 sm:pt-space-md border-t border-outline-variant/30 flex flex-col md:flex-row items-center justify-between text-xs sm:text-label-sm font-label-sm text-on-surface-variant gap-2 sm:gap-space-sm text-center md:text-left">
          <div>
            CleanMap Tripura · Independent civic prototype · No government affiliation.
          </div>
          <div>Map tiles and address lookup use OpenStreetMap services.</div>
        </div>
      </div>
    </footer>
  );
};
