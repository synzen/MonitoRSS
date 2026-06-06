import { toaster } from "@/components/ui/toaster";

export const notifySuccess = (title: string, description?: string) => {
  toaster.create({
    title,
    description,
    type: "success",
    duration: 5000,
  });
};

export default notifySuccess;
