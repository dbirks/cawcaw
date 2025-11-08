import { expect, test } from "@playwright/test";

/**
 * Mobile Overflow Tests
 *
 * These tests verify that the chat interface does not overflow horizontally
 * on mobile viewports, especially when displaying wide content like tables.
 *
 * Best practices followed:
 * - Test on actual mobile viewport dimensions (iPhone 16: 393x852)
 * - Test with real-world content (markdown tables, code blocks)
 * - Verify both body and specific containers
 * - Use page.evaluate for precise measurements
 */

test.describe("Mobile Overflow Prevention", () => {
	// Helper function to inject a mock message with wide content
	async function injectWideMessage(page: any, content: string) {
		await page.evaluate((html: string) => {
			const conversationContent = document.querySelector('[role="log"]');
			if (conversationContent) {
				conversationContent.innerHTML = html;
			}
		}, content);
		// Wait for any layout shifts
		await page.waitForTimeout(500);
	}

	// Helper function to check for horizontal overflow
	async function checkNoHorizontalOverflow(page: any) {
		const overflow = await page.evaluate(() => {
			const bodyScrollWidth = document.body.scrollWidth;
			const bodyClientWidth = document.body.clientWidth;
			const hasHorizontalScroll = bodyScrollWidth > bodyClientWidth;
			const overflowAmount = bodyScrollWidth - bodyClientWidth;

			// Also check the conversation container specifically
			const conversationContainer = document.querySelector(
				'[role="log"]',
			)?.parentElement;
			const containerRect = conversationContainer?.getBoundingClientRect();
			const containerComputedStyle = conversationContainer
				? window.getComputedStyle(conversationContainer)
				: null;

			return {
				bodyScrollWidth,
				bodyClientWidth,
				hasHorizontalScroll,
				overflowAmount,
				viewportWidth: window.innerWidth,
				conversationContainer: {
					width: containerRect?.width,
					overflowX: containerComputedStyle?.overflowX,
					overflowY: containerComputedStyle?.overflowY,
				},
			};
		});

		return overflow;
	}

	test("should not overflow horizontally on page load", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		const overflow = await checkNoHorizontalOverflow(page);

		expect(overflow.hasHorizontalScroll).toBe(false);
		expect(overflow.overflowAmount).toBe(0);
		expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(
			overflow.bodyClientWidth,
		);
	});

	test("should not overflow with wide markdown table", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Check if we're on the API key setup screen
		const conversationLog = await page.locator('[role="log"]').count();
		if (conversationLog === 0) {
			// Skip detailed conversation checks if no chat interface is present
			test.skip();
			return;
		}

		// Inject a realistic wide markdown table with 7 columns
		// Uses all the overflow fix classes: min-w-0, overflow-x-hidden, table wrapper with overflow-x-auto
		const wideTableMessage = `
      <div class="group flex w-full items-end justify-end gap-2 py-4 is-assistant flex-row-reverse justify-end">
        <div class="flex flex-col gap-2 overflow-x-hidden rounded-lg px-4 py-3 text-foreground text-sm min-w-0 bg-secondary">
          <div class="is-user:dark w-full max-w-full min-w-0">
            <div class="size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto">
              <table class="w-full" style="border-collapse: collapse;">
                <thead>
                  <tr>
                    <th style="border: 1px solid #ddd; padding: 8px;">Feature Name</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Description</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Status</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Priority</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Assigned To</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Due Date</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Dependencies</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">User Authentication System</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">Implement OAuth 2.0 with multiple providers</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">In Progress</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">High</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">Engineering Team A</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">2025-11-15</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">Database Schema v2.0</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">Real-time Notifications</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">WebSocket-based push notification system</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">Planning</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">Medium</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">Engineering Team B</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">2025-12-01</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">User Authentication System</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

		await injectWideMessage(page, wideTableMessage);

		const overflow = await checkNoHorizontalOverflow(page);

		// Take screenshot on failure for debugging
		if (overflow.hasHorizontalScroll) {
			await page.screenshot({
				path: "test-results/mobile-overflow-table-failure.png",
			});
		}

		expect(overflow.hasHorizontalScroll).toBe(false);
		expect(overflow.overflowAmount).toBe(0);
		// Only check conversation container if it exists
		if (overflow.conversationContainer.overflowX) {
			expect(overflow.conversationContainer.overflowX).toBe("hidden");
			expect(overflow.conversationContainer.overflowY).toBe("auto");
		}
	});

	test("should not overflow with long code block", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Inject a message with a long line of code
		const longCodeMessage = `
      <div class="group flex w-full items-end justify-end gap-2 py-4 is-assistant flex-row-reverse justify-end">
        <div class="flex flex-col gap-2 overflow-x-hidden rounded-lg px-4 py-3 text-foreground text-sm group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground max-w-[min(80%,42rem)]">
          <div class="is-user:dark">
            <pre><code>const veryLongVariableName = "this is an extremely long line of code that should not cause horizontal overflow in the chat interface";</code></pre>
          </div>
        </div>
      </div>
    `;

		await injectWideMessage(page, longCodeMessage);

		const overflow = await checkNoHorizontalOverflow(page);

		if (overflow.hasHorizontalScroll) {
			await page.screenshot({
				path: "test-results/mobile-overflow-code-failure.png",
			});
		}

		expect(overflow.hasHorizontalScroll).toBe(false);
		expect(overflow.overflowAmount).toBe(0);
	});

	test("should not overflow with long unbroken text", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Inject a message with very long unbroken text
		const longTextMessage = `
      <div class="group flex w-full items-end justify-end gap-2 py-4 is-assistant flex-row-reverse justify-end">
        <div class="flex flex-col gap-2 overflow-x-hidden rounded-lg px-4 py-3 text-foreground text-sm group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground max-w-[min(80%,42rem)]">
          <div class="is-user:dark">
            <p>ThisIsAnExtremelyLongUnbrokenWordThatShouldNotCauseHorizontalOverflowInTheChatInterfaceAndShouldBeHandledProperly</p>
          </div>
        </div>
      </div>
    `;

		await injectWideMessage(page, longTextMessage);

		const overflow = await checkNoHorizontalOverflow(page);

		if (overflow.hasHorizontalScroll) {
			await page.screenshot({
				path: "test-results/mobile-overflow-text-failure.png",
			});
		}

		expect(overflow.hasHorizontalScroll).toBe(false);
		expect(overflow.overflowAmount).toBe(0);
	});

	test("should maintain no overflow across multiple messages", async ({
		page,
	}) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Inject multiple messages with different wide content
		const multipleMessages = `
      <div class="group flex w-full items-end justify-end gap-2 py-4 is-assistant flex-row-reverse justify-end">
        <div class="flex flex-col gap-2 overflow-x-hidden rounded-lg px-4 py-3 text-foreground text-sm group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground max-w-[min(80%,42rem)]">
          <div class="is-user:dark">
            <table>
              <tr><td>Wide</td><td>Table</td><td>Content</td><td>Here</td></tr>
            </table>
          </div>
        </div>
      </div>
      <div class="group flex w-full items-end justify-end gap-2 py-4 is-assistant flex-row-reverse justify-end">
        <div class="flex flex-col gap-2 overflow-x-hidden rounded-lg px-4 py-3 text-foreground text-sm group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground max-w-[min(80%,42rem)]">
          <div class="is-user:dark">
            <pre><code>const anotherLongLineOfCodeHereToTestOverflow = true;</code></pre>
          </div>
        </div>
      </div>
    `;

		await injectWideMessage(page, multipleMessages);

		const overflow = await checkNoHorizontalOverflow(page);

		if (overflow.hasHorizontalScroll) {
			await page.screenshot({
				path: "test-results/mobile-overflow-multiple-failure.png",
			});
		}

		expect(overflow.hasHorizontalScroll).toBe(false);
		expect(overflow.overflowAmount).toBe(0);
	});

	test("should have correct overflow CSS properties", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Check if we're on the API key setup screen
		const conversationLog = await page.locator('[role="log"]').count();
		if (conversationLog === 0) {
			// Skip if no chat interface is present
			test.skip();
			return;
		}

		// Check that critical containers have the right overflow settings
		const overflowSettings = await page.evaluate(() => {
			const body = document.body;
			const conversationContainer = document.querySelector(
				'[role="log"]',
			)?.parentElement;
			const messageContainers =
				document.querySelectorAll(".overflow-x-hidden");

			return {
				body: {
					overflowX: window.getComputedStyle(body).overflowX,
				},
				conversationContainer: conversationContainer
					? {
							overflowX:
								window.getComputedStyle(conversationContainer).overflowX,
							overflowY:
								window.getComputedStyle(conversationContainer).overflowY,
						}
					: null,
				messageContainerCount: messageContainers.length,
			};
		});

		// Conversation container should prevent horizontal scroll
		expect(overflowSettings.conversationContainer?.overflowX).toBe("hidden");
		// But allow vertical scroll
		expect(overflowSettings.conversationContainer?.overflowY).toBe("auto");
	});
});
