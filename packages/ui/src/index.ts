export { Wordmark, type WordmarkProps } from "./wordmark";
export { CornerOrnament, DiamondRule, OrnamentFrame, ZigzagDivider, type Corner, type OrnamentFrameProps } from "./ornaments";
export { gsap, ScrollTrigger, useGSAP } from "./motion/gsap";
export { Reveal, type RevealProps } from "./motion/reveal";
export { usePrefersReducedMotion } from "./motion/use-prefers-reduced-motion";
export { AppProviders } from "./providers";

// Astryx components the apps use, re-exported so apps import from "@pandora/ui" and never add their own
// "@astryxdesign/core" dependency (one Astryx version, one place to theme). Astryx is imported per component
// ("@astryxdesign/core/Button"), so add a new line here for each extra component an app needs instead of
// re-exporting everything. See docs/tech/astryx.md.
export { Badge, type BadgeProps, type BadgeVariant } from "@astryxdesign/core/Badge";
export { Banner, type BannerProps } from "@astryxdesign/core/Banner";
export { Button, type ButtonProps } from "@astryxdesign/core/Button";
export { Card, type CardProps } from "@astryxdesign/core/Card";
export { Field, FieldLabel, FieldStatus, type FieldProps } from "@astryxdesign/core/Field";
export { FileInput, type FileInputProps } from "@astryxdesign/core/FileInput";
export { Heading, type HeadingProps } from "@astryxdesign/core/Heading";
export { HStack, type HStackProps } from "@astryxdesign/core/HStack";
export { Link, type LinkProps } from "@astryxdesign/core/Link";
export { Selector, SelectorOption, type SelectorProps } from "@astryxdesign/core/Selector";
export { Step, Stepper, type StepProps, type StepperProps } from "@astryxdesign/core/Stepper";
export { Text, type TextProps } from "@astryxdesign/core/Text";
export { TextArea, type TextAreaProps } from "@astryxdesign/core/TextArea";
export { TextInput, type TextInputProps } from "@astryxdesign/core/TextInput";
export { VStack, type VStackProps } from "@astryxdesign/core/VStack";
