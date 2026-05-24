"use client";

import { toast } from "sonner";

type ToastOpts = Record<string, unknown>;

type PromiseMessages<T> = {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((err: unknown) => string);
};

export const notify = {
  success(msg: string, opts?: ToastOpts) {
    return toast.success(msg, { ...(opts ?? {}), duration: 3000 });
  },
  error(msg: string, opts?: ToastOpts) {
    return toast.error(msg, { ...(opts ?? {}), duration: 5000 });
  },
  info(msg: string, opts?: ToastOpts) {
    return toast(msg, { ...(opts ?? {}), duration: 3000 });
  },
  loading(msg: string) {
    return toast.loading(msg);
  },
  dismiss(id?: string | number) {
    toast.dismiss(id);
  },
  promise<T>(p: Promise<T>, msgs: PromiseMessages<T>) {
    return toast.promise(p, msgs);
  },
};
