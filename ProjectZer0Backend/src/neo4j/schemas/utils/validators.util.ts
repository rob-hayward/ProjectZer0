// src/neo4j/schemas/utils/validators.util.ts

import { BadRequestException } from '@nestjs/common';
import { VotingUtils } from '../../../config/voting.config';

/**
 * Centralized validation utilities for Neo4j node schemas
 * Provides consistent validation across all node types
 */
export class NodeValidators {
  /**
   * Validates that a string field is not empty and optionally checks length
   * @param text The text to validate
   * @param fieldName Human-readable field name for error messages
   * @param maxLength Optional maximum length constraint
   * @throws BadRequestException if validation fails
   */
  static validateText(
    text: string | undefined | null,
    fieldName: string,
    maxLength?: number,
  ): void {
    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new BadRequestException(`${fieldName} cannot be empty`);
    }

    const trimmedText = text.trim();

    if (maxLength && trimmedText.length > maxLength) {
      throw new BadRequestException(
        `${fieldName} must not exceed ${maxLength} characters (current: ${trimmedText.length})`,
      );
    }
  }

  /**
   * Validates an ID field
   * @param id The ID to validate
   * @param fieldName Human-readable field name for error messages
   * @throws BadRequestException if validation fails
   */
  static validateId(
    id: string | undefined | null,
    fieldName: string = 'ID',
  ): void {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new BadRequestException(
        `${fieldName} is required and cannot be empty`,
      );
    }
  }

  /**
   * Validates a user ID
   * @param userId The user ID to validate
   * @throws BadRequestException if validation fails
   */
  static validateUserId(userId: string | undefined | null): void {
    this.validateId(userId, 'User ID');
  }

  /**
   * Validates that a node has passed inclusion threshold
   * @param netVotes The net votes count
   * @param action The action being attempted (for error message)
   * @param nodeType The type of node (for error message)
   * @throws BadRequestException if threshold not met
   */
  static validateInclusionThreshold(
    netVotes: number,
    action: string,
    nodeType: string = 'Node',
  ): void {
    if (!VotingUtils.hasPassedInclusion(netVotes)) {
      throw new BadRequestException(
        `${nodeType} must pass inclusion threshold before ${action}`,
      );
    }
  }

  /**
   * Validates category count doesn't exceed maximum
   * @param categories Array of category IDs
   * @param max Maximum allowed categories
   * @throws BadRequestException if too many categories
   */
  static validateCategoryCount(
    categories: string[] | undefined | null,
    max: number = 3,
  ): void {
    if (categories && categories.length > max) {
      throw new BadRequestException(
        `Maximum ${max} categories allowed (provided: ${categories.length})`,
      );
    }
  }

  /**
   * Validates an email address format
   * @param email The email to validate
   * @throws BadRequestException if invalid format
   */
  static validateEmail(email: string | undefined | null): void {
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }
  }

  /**
   * Validates a URL format
   * @param url The URL to validate
   * @param fieldName Human-readable field name for error messages
   * @throws BadRequestException if invalid format
   */
  static validateUrl(
    url: string | undefined | null,
    fieldName: string = 'URL',
  ): void {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      throw new BadRequestException(`${fieldName} cannot be empty`);
    }

    try {
      new URL(url);
    } catch {
      throw new BadRequestException(`Invalid ${fieldName} format`);
    }
  }

  /**
   * Validates a numeric value is within range
   * @param value The value to validate
   * @param min Minimum allowed value
   * @param max Maximum allowed value
   * @param fieldName Human-readable field name for error messages
   * @throws BadRequestException if out of range
   */
  static validateNumberRange(
    value: number | undefined | null,
    min: number,
    max: number,
    fieldName: string,
  ): void {
    if (value === undefined || value === null) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (typeof value !== 'number' || isNaN(value)) {
      throw new BadRequestException(`${fieldName} must be a valid number`);
    }

    if (value < min || value > max) {
      throw new BadRequestException(
        `${fieldName} must be between ${min} and ${max} (provided: ${value})`,
      );
    }
  }

  /**
   * Validates an array is not empty
   * @param array The array to validate
   * @param fieldName Human-readable field name for error messages
   * @throws BadRequestException if empty
   */
  static validateNonEmptyArray(
    array: any[] | undefined | null,
    fieldName: string,
  ): void {
    if (!array || !Array.isArray(array) || array.length === 0) {
      throw new BadRequestException(`${fieldName} cannot be empty`);
    }
  }

  /**
   * Validates an enum value
   * @param value The value to validate
   * @param validValues Array of valid enum values
   * @param fieldName Human-readable field name for error messages
   * @throws BadRequestException if invalid
   */
  static validateEnum<T>(
    value: T | undefined | null,
    validValues: T[],
    fieldName: string,
  ): void {
    if (value === undefined || value === null) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (!validValues.includes(value)) {
      throw new BadRequestException(
        `Invalid ${fieldName}. Must be one of: ${validValues.join(', ')}`,
      );
    }
  }

  /**
   * Validates a date is in valid format and optionally within range
   * @param date The date to validate
   * @param fieldName Human-readable field name for error messages
   * @param minDate Optional minimum date
   * @param maxDate Optional maximum date
   * @throws BadRequestException if invalid
   */
  static validateDate(
    date: Date | string | undefined | null,
    fieldName: string,
    minDate?: Date,
    maxDate?: Date,
  ): void {
    if (!date) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName} format`);
    }

    if (minDate && dateObj < minDate) {
      throw new BadRequestException(
        `${fieldName} cannot be before ${minDate.toISOString()}`,
      );
    }

    if (maxDate && dateObj > maxDate) {
      throw new BadRequestException(
        `${fieldName} cannot be after ${maxDate.toISOString()}`,
      );
    }
  }

  /**
   * Composite validation for node creation
   * Validates multiple common fields at once
   * @param data Object containing fields to validate
   * @throws BadRequestException if any validation fails
   */
  static validateNodeCreation(data: {
    id?: string | null;
    text?: string | null;
    textFieldName?: string;
    maxTextLength?: number;
    createdBy?: string | null;
    categoryIds?: string[] | null;
    maxCategories?: number;
    publicCredit?: boolean;
  }): void {
    // Validate ID
    this.validateId(data.id);

    // Validate user ID
    this.validateUserId(data.createdBy);

    // Validate main text field if provided
    if (data.text !== undefined) {
      this.validateText(
        data.text,
        data.textFieldName || 'Text',
        data.maxTextLength,
      );
    }

    // Validate category count if provided
    if (data.categoryIds !== undefined) {
      this.validateCategoryCount(data.categoryIds, data.maxCategories);
    }

    // Validate publicCredit is boolean if provided
    if (
      data.publicCredit !== undefined &&
      typeof data.publicCredit !== 'boolean'
    ) {
      throw new BadRequestException('Public credit must be a boolean value');
    }
  }

  /**
   * Validates update data to ensure at least one field is being updated
   * @param updateData The update data object
   * @param fieldName Human-readable name for the entity being updated
   * @throws BadRequestException if no fields to update
   */
  static validateUpdateData(
    updateData: Record<string, any> | undefined | null,
    fieldName: string = 'Update data',
  ): void {
    if (!updateData || typeof updateData !== 'object') {
      throw new BadRequestException(`${fieldName} must be provided`);
    }

    const validFields = Object.keys(updateData).filter(
      (key) => updateData[key] !== undefined,
    );

    if (validFields.length === 0) {
      throw new BadRequestException(
        `${fieldName} must contain at least one field to update`,
      );
    }
  }

  /**
   * Validates that two values are not the same (e.g., for relationships)
   * @param value1 First value
   * @param value2 Second value
   * @param message Custom error message
   * @throws BadRequestException if values are the same
   */
  static validateNotSame(
    value1: any,
    value2: any,
    message: string = 'Values cannot be the same',
  ): void {
    if (value1 === value2) {
      throw new BadRequestException(message);
    }
  }

  /**
   * Validates a boolean value
   * @param value The value to validate
   * @param fieldName Human-readable field name for error messages
   * @throws BadRequestException if not a boolean
   */
  static validateBoolean(value: any, fieldName: string): void {
    if (typeof value !== 'boolean') {
      throw new BadRequestException(`${fieldName} must be a boolean value`);
    }
  }

  /**
   * Validates that a string matches a pattern
   * @param value The string to validate
   * @param pattern The regex pattern to match
   * @param fieldName Human-readable field name for error messages
   * @param patternDescription Description of the expected format
   * @throws BadRequestException if pattern doesn't match
   */
  static validatePattern(
    value: string | undefined | null,
    pattern: RegExp,
    fieldName: string,
    patternDescription: string,
  ): void {
    this.validateText(value, fieldName);

    if (!pattern.test(value!)) {
      throw new BadRequestException(
        `${fieldName} must match format: ${patternDescription}`,
      );
    }
  }

  /**
   * Validates pagination parameters
   * @param offset The offset value
   * @param limit The limit value
   * @param maxLimit Maximum allowed limit
   * @throws BadRequestException if invalid
   */
  static validatePagination(
    offset?: number,
    limit?: number,
    maxLimit: number = 100,
  ): void {
    if (offset !== undefined) {
      if (
        typeof offset !== 'number' ||
        offset < 0 ||
        !Number.isInteger(offset)
      ) {
        throw new BadRequestException('Offset must be a non-negative integer');
      }
    }

    if (limit !== undefined) {
      if (typeof limit !== 'number' || limit <= 0 || !Number.isInteger(limit)) {
        throw new BadRequestException('Limit must be a positive integer');
      }

      if (limit > maxLimit) {
        throw new BadRequestException(
          `Limit cannot exceed ${maxLimit} (provided: ${limit})`,
        );
      }
    }
  }
}
