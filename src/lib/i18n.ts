/**
 * Centralized UI Internationalization (i18n) — English (en), Tamil (ta), Hindi (hi)
 * Follows plain, human, action-led UX copy principles.
 */

export type SupportedLocale = "en" | "ta" | "hi";

export interface UiTranslations {
  appName: string;
  tagline: string;
  syntheticBanner: string;
  nav: {
    report: string;
    nearby: string;
    myReports: string;
    igmerLab: string;
    authority: string;
    assistant: string;
  };
  reportForm: {
    heading: string;
    subheading: string;
    step1Title: string;
    step2Location: string;
    step3Evidence: string;
    titleLabel: string;
    titlePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    voiceStart: string;
    voiceStop: string;
    landmarkLabel: string;
    landmarkPlaceholder: string;
    locationConsentLabel: string;
    useGpsButton: string;
    photosLabel: string;
    photosHint: string;
    anonymousLabel: string;
    anonymousHint: string;
    submitButton: string;
    submittingButton: string;
    successHeading: string;
    anonymousTokenLabel: string;
  };
  tracker: {
    heading: string;
    emptyState: string;
    verifyResolution: string;
    disputeReopen: string;
    citizenVerifiedBadge: string;
  };
  nearby: {
    heading: string;
    mapView: string;
    listView: string;
    heatmapToggle: string;
  };
}

export const TRANSLATIONS: Record<SupportedLocale, UiTranslations> = {
  en: {
    appName: "CivicResolve",
    tagline: "One problem. Multiple citizens. One tracked incident.",
    syntheticBanner: "Synthetic Demo Dataset (Chennai / Tamil Nadu Municipal Jurisdiction Rules)",
    nav: {
      report: "Report a Problem",
      nearby: "Nearby & Map",
      myReports: "My Reports",
      igmerLab: "IGMER Clustering",
      authority: "Authority & Admin",
      assistant: "Civic Helper",
    },
    reportForm: {
      heading: "Report a problem in your neighborhood",
      subheading:
        "Tell us what's wrong in plain words. You don't need to know which department handles it—we route it automatically.",
      step1Title: "1. What happened?",
      step2Location: "2. Where is it?",
      step3Evidence: "3. Photos & privacy (optional)",
      titleLabel: "Short summary",
      titlePlaceholder: "e.g., Exposed streetlight wire near bus shelter",
      descriptionLabel: "Details",
      descriptionPlaceholder:
        "Describe what you see and whether anyone is at risk. You can write in English, Tamil, or Hindi.",
      voiceStart: "Speak description",
      voiceStop: "Stop listening",
      landmarkLabel: "Street or landmark",
      landmarkPlaceholder: "e.g., Anna Nagar Roundtana, Ward 101, Chennai",
      locationConsentLabel:
        "I consent to share the issue coordinates so municipal crews can locate the problem.",
      useGpsButton: "Use current GPS pin",
      photosLabel: "Upload up to 4 photos (JPEG, PNG, WebP · max 5 MB each)",
      photosHint: "EXIF personal GPS metadata is stripped automatically before public display.",
      anonymousLabel: "Submit anonymously",
      anonymousHint:
        "We'll give you a private tracking token so you can still verify when the fix is done.",
      submitButton: "Report a problem",
      submittingButton: "Saving your report...",
      successHeading: "We got your report.",
      anonymousTokenLabel: "Save your private verification token:",
    },
    tracker: {
      heading: "Track & Verify Reported Incidents",
      emptyState:
        "No matching reports found. Try clearing your search filter or submit a new problem report.",
      verifyResolution: "Confirm fix is complete",
      disputeReopen: "Not fixed — Reopen incident",
      citizenVerifiedBadge: "Citizen Verified",
    },
    nearby: {
      heading: "Nearby Civic Incidents & Heatmap",
      mapView: "Interactive Map View",
      listView: "Accessible List View",
      heatmapToggle: "Show Cluster Intensity Heatmap",
    },
  },
  ta: {
    appName: "சிவிக்ரிசால்வ் (CivicResolve)",
    tagline: "ஒரு பிரச்சனை. பல குடிமக்கள். ஒருங்கிணைந்த தீர்வு.",
    syntheticBanner: "மாதிரி தரவுத்தொகுப்பு (சென்னை / தமிழ்நாடு நகராட்சி மண்டல விதிகள்)",
    nav: {
      report: "புகார் அளிக்க",
      nearby: "அருகிலுள்ளவை & வரைபடம்",
      myReports: "எனது புகார்கள்",
      igmerLab: "IGMER தொகுப்பு",
      authority: "அதிகாரி தளம்",
      assistant: "AI உதவி",
    },
    reportForm: {
      heading: "உங்கள் பகுதி பிரச்சனையைப் புகாரளிக்கவும்",
      subheading:
        "எந்தத் துறை என்று நீங்கள் அறிய வேண்டியதில்லை — AI தானாகவே சரியான துறைக்கு அனுப்பும்.",
      step1Title: "1. என்ன பிரச்சனை?",
      step2Location: "2. எங்கே உள்ளது?",
      step3Evidence: "3. புகைப்படங்கள் & தனியுரிமை (விருப்பத்தேர்வு)",
      titleLabel: "சுருக்கமான தலைப்பு",
      titlePlaceholder: "எ.கா., பேருந்து நிறுத்தம் அருகே உடைந்த தெருவிளக்கு கம்பி",
      descriptionLabel: "விவரங்கள்",
      descriptionPlaceholder: "பிரச்சனையை தமிழ், ஆங்கிலம் அல்லது இந்தியில் விவரிக்கவும்.",
      voiceStart: "குரல் மூலம் பதிவு செய்",
      voiceStop: "நிறுத்து",
      landmarkLabel: "தெரு அல்லது அடையாளம்",
      landmarkPlaceholder: "எ.கா., அண்ணா நகர் ரவுண்டானா, வார்டு 101, சென்னை",
      locationConsentLabel:
        "பழுதுபார்க்கும் குழு இடத்தைக் கண்டறிய இருப்பிடத் தகவலைப் பகிர சம்மதிக்கிறேன்.",
      useGpsButton: "தற்போதைய GPS இருப்பிடம்",
      photosLabel: "4 புகைப்படங்கள் வரை இணைக்கவும் (அதிகபட்சம் 5 MB)",
      photosHint: "புகைப்படங்களின் தனிப்பட்ட EXIF GPS தரவு தானாகவே அகற்றப்படும்.",
      anonymousLabel: "பெயர் குறிப்பிடாமல் புகாரளி",
      anonymousHint: "தீர்வைச் சரிபார்க்க தனிப்பட்ட டோக்கன் வழங்கப்படும்.",
      submitButton: "புகாரைப் பதிவு செய்",
      submittingButton: "பதிவு செய்யப்படுகிறது...",
      successHeading: "உங்கள் புகார் பெறப்பட்டது.",
      anonymousTokenLabel: "உங்கள் சரிபார்ப்பு டோக்கனைச் சேமிக்கவும்:",
    },
    tracker: {
      heading: "புகார் நிலை & தீர்வு சரிபார்ப்பு",
      emptyState: "புகார்கள் எதுவும் இல்லை. வடிகட்டியை மாற்றவும் அல்லது புதிய புகார் அளிக்கவும்.",
      verifyResolution: "தீர்வு சரிபார்க்கப்பட்டது",
      disputeReopen: "சரியாகவில்லை — மீண்டும் திறக்கவும்",
      citizenVerifiedBadge: "குடிமக்கள் உறுதிப்படுத்தியது",
    },
    nearby: {
      heading: "அருகிலுள்ள புகார்கள் & வரைபடம்",
      mapView: "வரைபடக் காட்சி",
      listView: "பட்டியல் காட்சி (அணுகல்தன்மை)",
      heatmapToggle: "அடர்த்தி வரைபடம் (Heatmap)",
    },
  },
  hi: {
    appName: "सिविक-रिज़ॉल्व (CivicResolve)",
    tagline: "एक समस्या। अनेक नागरिक। एक एकीकृत समाधान।",
    syntheticBanner: "सिंथेटिक डेमो डेटासेट (चेन्नई / तमिलनाडु नगर निगम नियम)",
    nav: {
      report: "समस्या दर्ज करें",
      nearby: "आस-पास और नक्शा",
      myReports: "मेरी शिकायतें",
      igmerLab: "IGMER क्लस्टरिंग",
      authority: "अधिकारी डैशबोर्ड",
      assistant: "AI सहायक",
    },
    reportForm: {
      heading: "अपने क्षेत्र की समस्या दर्ज करें",
      subheading:
        "आपको विभाग का नाम जानने की ज़रूरत नहीं है — हमारा AI इसे सही विभाग तक पहुँचाता है।",
      step1Title: "1. क्या समस्या है?",
      step2Location: "2. यह कहाँ है?",
      step3Evidence: "3. फ़ोटो और गोपनीयता (वैकल्पिक)",
      titleLabel: "संक्षिप्त शीर्षक",
      titlePlaceholder: "उदा., बस स्टॉप के पास टूटा हुआ स्ट्रीटलाइट तार",
      descriptionLabel: "विवरण",
      descriptionPlaceholder: "समस्या का विवरण हिंदी, तमिल या अंग्रेज़ी में लिखें।",
      voiceStart: "बोलकर लिखें",
      voiceStop: "सुनना बंद करें",
      landmarkLabel: "सड़क या लैंडमार्क",
      landmarkPlaceholder: "उदा., अन्ना नगर राउंडटाना, वार्ड 101, चेन्नई",
      locationConsentLabel:
        "मैं मरम्मत दल के लिए समस्या का स्थान साझा करने की सहमति देता/देती हूँ।",
      useGpsButton: "वर्तमान GPS पिन",
      photosLabel: "अधिकतम 4 फ़ोटो अपलोड करें (अधिकतम 5 MB प्रत्येक)",
      photosHint: "सार्वजनिक प्रदर्शन से पहले EXIF GPS डेटा स्वचालित रूप से हटा दिया जाता है।",
      anonymousLabel: "गुमनाम रूप से दर्ज करें",
      anonymousHint: "समाधान की पुष्टि करने के लिए आपको एक निजी ट्रैकिंग टोकन मिलेगा।",
      submitButton: "समस्या दर्ज करें",
      submittingButton: "आपकी शिकायत सहेजी जा रही है...",
      successHeading: "हमें आपकी शिकायत मिल गई है।",
      anonymousTokenLabel: "अपना निजी सत्यापन टोकन सुरक्षित रखें:",
    },
    tracker: {
      heading: "शिकायत की स्थिति और समाधान सत्यापन",
      emptyState: "कोई शिकायत नहीं मिली। फ़िल्टर हटाएँ या नई समस्या दर्ज करें।",
      verifyResolution: "समाधान की पुष्टि करें",
      disputeReopen: "ठीक नहीं हुआ — फिर से खोलें",
      citizenVerifiedBadge: "नागरिक द्वारा सत्यापित",
    },
    nearby: {
      heading: "आस-पास की शिकायतें और हीटमैप",
      mapView: "इंटरैक्टिव मानचित्र",
      listView: "सुलभ सूची दृश्य (List View)",
      heatmapToggle: "क्लस्टर हीटमैप दिखाएँ",
    },
  },
};
