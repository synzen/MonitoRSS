import { toaster } from "@/components/ui/toaster";

export const notifyInfo = (title: string, description?: string) => {
  toaster.create({
    title,
    description,
    type: "info",
    duration: 5000,
  });
};

export default notifyInfo;
