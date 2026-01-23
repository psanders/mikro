/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
/* eslint-disable */
// biome-ignore-all lint: generated file
// @ts-nocheck
/*
 * This file exports various common sort, input & filter types that are not directly linked to a particular model.
 *
 * 🟢 You can import this file directly.
 */

import type * as runtime from "@prisma/client/runtime/client";
import * as $Enums from "./enums.js";
import type * as Prisma from "./internal/prismaNamespace.js";

export type StringFilter<$PrismaModel = never> = {
  equals?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  in?: string[];
  notIn?: string[];
  lt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  lte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  contains?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  startsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  endsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedStringFilter<$PrismaModel> | string;
};

export type DateTimeFilter<$PrismaModel = never> = {
  equals?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  in?: Date[] | string[];
  notIn?: Date[] | string[];
  lt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  lte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedDateTimeFilter<$PrismaModel> | Date | string;
};

export type StringWithAggregatesFilter<$PrismaModel = never> = {
  equals?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  in?: string[];
  notIn?: string[];
  lt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  lte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  contains?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  startsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  endsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedStringWithAggregatesFilter<$PrismaModel> | string;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedStringFilter<$PrismaModel>;
  _max?: Prisma.NestedStringFilter<$PrismaModel>;
};

export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
  equals?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  in?: Date[] | string[];
  notIn?: Date[] | string[];
  lt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  lte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedDateTimeFilter<$PrismaModel>;
  _max?: Prisma.NestedDateTimeFilter<$PrismaModel>;
};

export type EnumRoleFilter<$PrismaModel = never> = {
  equals?: $Enums.Role | Prisma.EnumRoleFieldRefInput<$PrismaModel>;
  in?: $Enums.Role[];
  notIn?: $Enums.Role[];
  not?: Prisma.NestedEnumRoleFilter<$PrismaModel> | $Enums.Role;
};

export type EnumRoleWithAggregatesFilter<$PrismaModel = never> = {
  equals?: $Enums.Role | Prisma.EnumRoleFieldRefInput<$PrismaModel>;
  in?: $Enums.Role[];
  notIn?: $Enums.Role[];
  not?: Prisma.NestedEnumRoleWithAggregatesFilter<$PrismaModel> | $Enums.Role;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedEnumRoleFilter<$PrismaModel>;
  _max?: Prisma.NestedEnumRoleFilter<$PrismaModel>;
};

export type StringNullableFilter<$PrismaModel = never> = {
  equals?: string | Prisma.StringFieldRefInput<$PrismaModel> | null;
  in?: string[] | null;
  notIn?: string[] | null;
  lt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  lte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  contains?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  startsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  endsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedStringNullableFilter<$PrismaModel> | string | null;
};

export type DecimalNullableFilter<$PrismaModel = never> = {
  equals?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>
    | null;
  in?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null;
  notIn?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null;
  lt?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  lte?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  gt?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  gte?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  not?:
    | Prisma.NestedDecimalNullableFilter<$PrismaModel>
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null;
};

export type BoolFilter<$PrismaModel = never> = {
  equals?: boolean | Prisma.BooleanFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedBoolFilter<$PrismaModel> | boolean;
};

export type SortOrderInput = {
  sort: Prisma.SortOrder;
  nulls?: Prisma.NullsOrder;
};

export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
  equals?: string | Prisma.StringFieldRefInput<$PrismaModel> | null;
  in?: string[] | null;
  notIn?: string[] | null;
  lt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  lte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  contains?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  startsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  endsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null;
  _count?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _min?: Prisma.NestedStringNullableFilter<$PrismaModel>;
  _max?: Prisma.NestedStringNullableFilter<$PrismaModel>;
};

export type DecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
  equals?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>
    | null;
  in?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null;
  notIn?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null;
  lt?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  lte?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  gt?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  gte?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  not?:
    | Prisma.NestedDecimalNullableWithAggregatesFilter<$PrismaModel>
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null;
  _count?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _avg?: Prisma.NestedDecimalNullableFilter<$PrismaModel>;
  _sum?: Prisma.NestedDecimalNullableFilter<$PrismaModel>;
  _min?: Prisma.NestedDecimalNullableFilter<$PrismaModel>;
  _max?: Prisma.NestedDecimalNullableFilter<$PrismaModel>;
};

export type BoolWithAggregatesFilter<$PrismaModel = never> = {
  equals?: boolean | Prisma.BooleanFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedBoolWithAggregatesFilter<$PrismaModel> | boolean;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedBoolFilter<$PrismaModel>;
  _max?: Prisma.NestedBoolFilter<$PrismaModel>;
};

export type IntFilter<$PrismaModel = never> = {
  equals?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  in?: number[];
  notIn?: number[];
  lt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  lte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedIntFilter<$PrismaModel> | number;
};

export type EnumLoanTypeFilter<$PrismaModel = never> = {
  equals?: $Enums.LoanType | Prisma.EnumLoanTypeFieldRefInput<$PrismaModel>;
  in?: $Enums.LoanType[];
  notIn?: $Enums.LoanType[];
  not?: Prisma.NestedEnumLoanTypeFilter<$PrismaModel> | $Enums.LoanType;
};

export type EnumLoanStatusFilter<$PrismaModel = never> = {
  equals?: $Enums.LoanStatus | Prisma.EnumLoanStatusFieldRefInput<$PrismaModel>;
  in?: $Enums.LoanStatus[];
  notIn?: $Enums.LoanStatus[];
  not?: Prisma.NestedEnumLoanStatusFilter<$PrismaModel> | $Enums.LoanStatus;
};

export type DateTimeNullableFilter<$PrismaModel = never> = {
  equals?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel> | null;
  in?: Date[] | string[] | null;
  notIn?: Date[] | string[] | null;
  lt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  lte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null;
};

export type IntWithAggregatesFilter<$PrismaModel = never> = {
  equals?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  in?: number[];
  notIn?: number[];
  lt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  lte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedIntWithAggregatesFilter<$PrismaModel> | number;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _avg?: Prisma.NestedFloatFilter<$PrismaModel>;
  _sum?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedIntFilter<$PrismaModel>;
  _max?: Prisma.NestedIntFilter<$PrismaModel>;
};

export type EnumLoanTypeWithAggregatesFilter<$PrismaModel = never> = {
  equals?: $Enums.LoanType | Prisma.EnumLoanTypeFieldRefInput<$PrismaModel>;
  in?: $Enums.LoanType[];
  notIn?: $Enums.LoanType[];
  not?: Prisma.NestedEnumLoanTypeWithAggregatesFilter<$PrismaModel> | $Enums.LoanType;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedEnumLoanTypeFilter<$PrismaModel>;
  _max?: Prisma.NestedEnumLoanTypeFilter<$PrismaModel>;
};

export type EnumLoanStatusWithAggregatesFilter<$PrismaModel = never> = {
  equals?: $Enums.LoanStatus | Prisma.EnumLoanStatusFieldRefInput<$PrismaModel>;
  in?: $Enums.LoanStatus[];
  notIn?: $Enums.LoanStatus[];
  not?: Prisma.NestedEnumLoanStatusWithAggregatesFilter<$PrismaModel> | $Enums.LoanStatus;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedEnumLoanStatusFilter<$PrismaModel>;
  _max?: Prisma.NestedEnumLoanStatusFilter<$PrismaModel>;
};

export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
  equals?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel> | null;
  in?: Date[] | string[] | null;
  notIn?: Date[] | string[] | null;
  lt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  lte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null;
  _count?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _min?: Prisma.NestedDateTimeNullableFilter<$PrismaModel>;
  _max?: Prisma.NestedDateTimeNullableFilter<$PrismaModel>;
};

export type EnumMessageRoleFilter<$PrismaModel = never> = {
  equals?: $Enums.MessageRole | Prisma.EnumMessageRoleFieldRefInput<$PrismaModel>;
  in?: $Enums.MessageRole[];
  notIn?: $Enums.MessageRole[];
  not?: Prisma.NestedEnumMessageRoleFilter<$PrismaModel> | $Enums.MessageRole;
};

export type EnumMessageRoleWithAggregatesFilter<$PrismaModel = never> = {
  equals?: $Enums.MessageRole | Prisma.EnumMessageRoleFieldRefInput<$PrismaModel>;
  in?: $Enums.MessageRole[];
  notIn?: $Enums.MessageRole[];
  not?: Prisma.NestedEnumMessageRoleWithAggregatesFilter<$PrismaModel> | $Enums.MessageRole;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedEnumMessageRoleFilter<$PrismaModel>;
  _max?: Prisma.NestedEnumMessageRoleFilter<$PrismaModel>;
};

export type EnumAttachmentTypeFilter<$PrismaModel = never> = {
  equals?: $Enums.AttachmentType | Prisma.EnumAttachmentTypeFieldRefInput<$PrismaModel>;
  in?: $Enums.AttachmentType[];
  notIn?: $Enums.AttachmentType[];
  not?: Prisma.NestedEnumAttachmentTypeFilter<$PrismaModel> | $Enums.AttachmentType;
};

export type IntNullableFilter<$PrismaModel = never> = {
  equals?: number | Prisma.IntFieldRefInput<$PrismaModel> | null;
  in?: number[] | null;
  notIn?: number[] | null;
  lt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  lte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedIntNullableFilter<$PrismaModel> | number | null;
};

export type EnumAttachmentTypeWithAggregatesFilter<$PrismaModel = never> = {
  equals?: $Enums.AttachmentType | Prisma.EnumAttachmentTypeFieldRefInput<$PrismaModel>;
  in?: $Enums.AttachmentType[];
  notIn?: $Enums.AttachmentType[];
  not?: Prisma.NestedEnumAttachmentTypeWithAggregatesFilter<$PrismaModel> | $Enums.AttachmentType;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedEnumAttachmentTypeFilter<$PrismaModel>;
  _max?: Prisma.NestedEnumAttachmentTypeFilter<$PrismaModel>;
};

export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
  equals?: number | Prisma.IntFieldRefInput<$PrismaModel> | null;
  in?: number[] | null;
  notIn?: number[] | null;
  lt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  lte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null;
  _count?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _avg?: Prisma.NestedFloatNullableFilter<$PrismaModel>;
  _sum?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _min?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _max?: Prisma.NestedIntNullableFilter<$PrismaModel>;
};

export type NestedStringFilter<$PrismaModel = never> = {
  equals?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  in?: string[];
  notIn?: string[];
  lt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  lte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  contains?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  startsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  endsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedStringFilter<$PrismaModel> | string;
};

export type NestedDateTimeFilter<$PrismaModel = never> = {
  equals?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  in?: Date[] | string[];
  notIn?: Date[] | string[];
  lt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  lte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedDateTimeFilter<$PrismaModel> | Date | string;
};

export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
  equals?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  in?: string[];
  notIn?: string[];
  lt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  lte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  contains?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  startsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  endsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedStringWithAggregatesFilter<$PrismaModel> | string;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedStringFilter<$PrismaModel>;
  _max?: Prisma.NestedStringFilter<$PrismaModel>;
};

export type NestedIntFilter<$PrismaModel = never> = {
  equals?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  in?: number[];
  notIn?: number[];
  lt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  lte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedIntFilter<$PrismaModel> | number;
};

export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
  equals?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  in?: Date[] | string[];
  notIn?: Date[] | string[];
  lt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  lte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedDateTimeFilter<$PrismaModel>;
  _max?: Prisma.NestedDateTimeFilter<$PrismaModel>;
};

export type NestedEnumRoleFilter<$PrismaModel = never> = {
  equals?: $Enums.Role | Prisma.EnumRoleFieldRefInput<$PrismaModel>;
  in?: $Enums.Role[];
  notIn?: $Enums.Role[];
  not?: Prisma.NestedEnumRoleFilter<$PrismaModel> | $Enums.Role;
};

export type NestedEnumRoleWithAggregatesFilter<$PrismaModel = never> = {
  equals?: $Enums.Role | Prisma.EnumRoleFieldRefInput<$PrismaModel>;
  in?: $Enums.Role[];
  notIn?: $Enums.Role[];
  not?: Prisma.NestedEnumRoleWithAggregatesFilter<$PrismaModel> | $Enums.Role;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedEnumRoleFilter<$PrismaModel>;
  _max?: Prisma.NestedEnumRoleFilter<$PrismaModel>;
};

export type NestedStringNullableFilter<$PrismaModel = never> = {
  equals?: string | Prisma.StringFieldRefInput<$PrismaModel> | null;
  in?: string[] | null;
  notIn?: string[] | null;
  lt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  lte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  contains?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  startsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  endsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedStringNullableFilter<$PrismaModel> | string | null;
};

export type NestedDecimalNullableFilter<$PrismaModel = never> = {
  equals?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>
    | null;
  in?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null;
  notIn?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null;
  lt?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  lte?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  gt?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  gte?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  not?:
    | Prisma.NestedDecimalNullableFilter<$PrismaModel>
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null;
};

export type NestedBoolFilter<$PrismaModel = never> = {
  equals?: boolean | Prisma.BooleanFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedBoolFilter<$PrismaModel> | boolean;
};

export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
  equals?: string | Prisma.StringFieldRefInput<$PrismaModel> | null;
  in?: string[] | null;
  notIn?: string[] | null;
  lt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  lte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gt?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  gte?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  contains?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  startsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  endsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null;
  _count?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _min?: Prisma.NestedStringNullableFilter<$PrismaModel>;
  _max?: Prisma.NestedStringNullableFilter<$PrismaModel>;
};

export type NestedIntNullableFilter<$PrismaModel = never> = {
  equals?: number | Prisma.IntFieldRefInput<$PrismaModel> | null;
  in?: number[] | null;
  notIn?: number[] | null;
  lt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  lte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedIntNullableFilter<$PrismaModel> | number | null;
};

export type NestedDecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
  equals?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>
    | null;
  in?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null;
  notIn?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null;
  lt?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  lte?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  gt?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  gte?:
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | Prisma.DecimalFieldRefInput<$PrismaModel>;
  not?:
    | Prisma.NestedDecimalNullableWithAggregatesFilter<$PrismaModel>
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null;
  _count?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _avg?: Prisma.NestedDecimalNullableFilter<$PrismaModel>;
  _sum?: Prisma.NestedDecimalNullableFilter<$PrismaModel>;
  _min?: Prisma.NestedDecimalNullableFilter<$PrismaModel>;
  _max?: Prisma.NestedDecimalNullableFilter<$PrismaModel>;
};

export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
  equals?: boolean | Prisma.BooleanFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedBoolWithAggregatesFilter<$PrismaModel> | boolean;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedBoolFilter<$PrismaModel>;
  _max?: Prisma.NestedBoolFilter<$PrismaModel>;
};

export type NestedEnumLoanTypeFilter<$PrismaModel = never> = {
  equals?: $Enums.LoanType | Prisma.EnumLoanTypeFieldRefInput<$PrismaModel>;
  in?: $Enums.LoanType[];
  notIn?: $Enums.LoanType[];
  not?: Prisma.NestedEnumLoanTypeFilter<$PrismaModel> | $Enums.LoanType;
};

export type NestedEnumLoanStatusFilter<$PrismaModel = never> = {
  equals?: $Enums.LoanStatus | Prisma.EnumLoanStatusFieldRefInput<$PrismaModel>;
  in?: $Enums.LoanStatus[];
  notIn?: $Enums.LoanStatus[];
  not?: Prisma.NestedEnumLoanStatusFilter<$PrismaModel> | $Enums.LoanStatus;
};

export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
  equals?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel> | null;
  in?: Date[] | string[] | null;
  notIn?: Date[] | string[] | null;
  lt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  lte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null;
};

export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
  equals?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  in?: number[];
  notIn?: number[];
  lt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  lte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedIntWithAggregatesFilter<$PrismaModel> | number;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _avg?: Prisma.NestedFloatFilter<$PrismaModel>;
  _sum?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedIntFilter<$PrismaModel>;
  _max?: Prisma.NestedIntFilter<$PrismaModel>;
};

export type NestedFloatFilter<$PrismaModel = never> = {
  equals?: number | Prisma.FloatFieldRefInput<$PrismaModel>;
  in?: number[];
  notIn?: number[];
  lt?: number | Prisma.FloatFieldRefInput<$PrismaModel>;
  lte?: number | Prisma.FloatFieldRefInput<$PrismaModel>;
  gt?: number | Prisma.FloatFieldRefInput<$PrismaModel>;
  gte?: number | Prisma.FloatFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedFloatFilter<$PrismaModel> | number;
};

export type NestedEnumLoanTypeWithAggregatesFilter<$PrismaModel = never> = {
  equals?: $Enums.LoanType | Prisma.EnumLoanTypeFieldRefInput<$PrismaModel>;
  in?: $Enums.LoanType[];
  notIn?: $Enums.LoanType[];
  not?: Prisma.NestedEnumLoanTypeWithAggregatesFilter<$PrismaModel> | $Enums.LoanType;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedEnumLoanTypeFilter<$PrismaModel>;
  _max?: Prisma.NestedEnumLoanTypeFilter<$PrismaModel>;
};

export type NestedEnumLoanStatusWithAggregatesFilter<$PrismaModel = never> = {
  equals?: $Enums.LoanStatus | Prisma.EnumLoanStatusFieldRefInput<$PrismaModel>;
  in?: $Enums.LoanStatus[];
  notIn?: $Enums.LoanStatus[];
  not?: Prisma.NestedEnumLoanStatusWithAggregatesFilter<$PrismaModel> | $Enums.LoanStatus;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedEnumLoanStatusFilter<$PrismaModel>;
  _max?: Prisma.NestedEnumLoanStatusFilter<$PrismaModel>;
};

export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
  equals?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel> | null;
  in?: Date[] | string[] | null;
  notIn?: Date[] | string[] | null;
  lt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  lte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  gte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null;
  _count?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _min?: Prisma.NestedDateTimeNullableFilter<$PrismaModel>;
  _max?: Prisma.NestedDateTimeNullableFilter<$PrismaModel>;
};

export type NestedEnumMessageRoleFilter<$PrismaModel = never> = {
  equals?: $Enums.MessageRole | Prisma.EnumMessageRoleFieldRefInput<$PrismaModel>;
  in?: $Enums.MessageRole[];
  notIn?: $Enums.MessageRole[];
  not?: Prisma.NestedEnumMessageRoleFilter<$PrismaModel> | $Enums.MessageRole;
};

export type NestedEnumMessageRoleWithAggregatesFilter<$PrismaModel = never> = {
  equals?: $Enums.MessageRole | Prisma.EnumMessageRoleFieldRefInput<$PrismaModel>;
  in?: $Enums.MessageRole[];
  notIn?: $Enums.MessageRole[];
  not?: Prisma.NestedEnumMessageRoleWithAggregatesFilter<$PrismaModel> | $Enums.MessageRole;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedEnumMessageRoleFilter<$PrismaModel>;
  _max?: Prisma.NestedEnumMessageRoleFilter<$PrismaModel>;
};

export type NestedEnumAttachmentTypeFilter<$PrismaModel = never> = {
  equals?: $Enums.AttachmentType | Prisma.EnumAttachmentTypeFieldRefInput<$PrismaModel>;
  in?: $Enums.AttachmentType[];
  notIn?: $Enums.AttachmentType[];
  not?: Prisma.NestedEnumAttachmentTypeFilter<$PrismaModel> | $Enums.AttachmentType;
};

export type NestedEnumAttachmentTypeWithAggregatesFilter<$PrismaModel = never> = {
  equals?: $Enums.AttachmentType | Prisma.EnumAttachmentTypeFieldRefInput<$PrismaModel>;
  in?: $Enums.AttachmentType[];
  notIn?: $Enums.AttachmentType[];
  not?: Prisma.NestedEnumAttachmentTypeWithAggregatesFilter<$PrismaModel> | $Enums.AttachmentType;
  _count?: Prisma.NestedIntFilter<$PrismaModel>;
  _min?: Prisma.NestedEnumAttachmentTypeFilter<$PrismaModel>;
  _max?: Prisma.NestedEnumAttachmentTypeFilter<$PrismaModel>;
};

export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
  equals?: number | Prisma.IntFieldRefInput<$PrismaModel> | null;
  in?: number[] | null;
  notIn?: number[] | null;
  lt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  lte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gt?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  gte?: number | Prisma.IntFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null;
  _count?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _avg?: Prisma.NestedFloatNullableFilter<$PrismaModel>;
  _sum?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _min?: Prisma.NestedIntNullableFilter<$PrismaModel>;
  _max?: Prisma.NestedIntNullableFilter<$PrismaModel>;
};

export type NestedFloatNullableFilter<$PrismaModel = never> = {
  equals?: number | Prisma.FloatFieldRefInput<$PrismaModel> | null;
  in?: number[] | null;
  notIn?: number[] | null;
  lt?: number | Prisma.FloatFieldRefInput<$PrismaModel>;
  lte?: number | Prisma.FloatFieldRefInput<$PrismaModel>;
  gt?: number | Prisma.FloatFieldRefInput<$PrismaModel>;
  gte?: number | Prisma.FloatFieldRefInput<$PrismaModel>;
  not?: Prisma.NestedFloatNullableFilter<$PrismaModel> | number | null;
};
